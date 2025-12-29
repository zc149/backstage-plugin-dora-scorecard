import { DoraMetricsStore } from '../database/DoraMetricsStore';
import { ScorecardResponse, MetricData } from '../types';

export class DoraMetricsService {
  constructor(
    private readonly store: DoraMetricsStore,
  ) {}

  async getScorecard(service: string, days: number = 30): Promise<ScorecardResponse> {
    const entityRef = `component:default/${service}`.toLowerCase();

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - days);
    const prevDate = new Date();
    prevDate.setDate(pastDate.getDate() - days);

    // Fetch aggregate metrics
    const currentRaw = await this.store.getMetricsForPeriod(entityRef, pastDate, today);
    const previousRaw = await this.store.getMetricsForPeriod(entityRef, prevDate, pastDate);

    // Fetch daily history for charts
    const dailyRows = await this.store.getDailyHistory(entityRef, pastDate, today);

    const historyMap = this.buildHistoryMap(dailyRows, pastDate, days);

    const cur = this.parseMetrics(currentRaw);
    const prev = this.parseMetrics(previousRaw);

    // Get targets
    const targetRow = await this.store.getTargets(entityRef);
    const targets = {
      freq: targetRow?.target_freq ?? 7,
      lead: targetRow?.target_lead ?? 24,
      fail: targetRow?.target_fail ?? 5,
      mttr: targetRow?.target_mttr ?? 60,
    };

    // Calculate metrics
    const metrics = {
      deploymentFrequency: this.buildMetricData(
        this.calculateMetric(cur.deploy, cur.fail, 'freq', days),
        this.calculateMetric(prev.deploy, prev.fail, 'freq', days),
        targets.freq,
        'deploymentFrequency',
        historyMap.freq
      ),
      leadTime: this.buildMetricData(
        this.calculateMetric(cur.lead, 0, 'lead', days),
        this.calculateMetric(prev.lead, 0, 'lead', days),
        targets.lead,
        'leadTime',
        historyMap.lead
      ),
      changeFailureRate: this.buildMetricData(
        this.calculateMetric(cur.deploy, cur.fail, 'fail', days),
        this.calculateMetric(prev.deploy, prev.fail, 'fail', days),
        targets.fail,
        'changeFailureRate',
        historyMap.fail
      ),
      mttr: this.buildMetricData(
        this.calculateMetric(cur.mttr, 0, 'mttr', days),
        this.calculateMetric(prev.mttr, 0, 'mttr', days),
        targets.mttr,
        'mttr',
        historyMap.mttr
      ),
    };

    const overallScore = this.calculateOverallScore(metrics);

    return {
      service,
      period: `${days} days`,
      metrics,
      overallScore: Math.round(overallScore),
      overallTier: this.getOverallTier(overallScore),
    };
  }

  async updateTargets(service: string, targets: {
    deploymentFrequency: number;
    leadTime: number;
    changeFailureRate: number;
    mttr: number;
  }): Promise<void> {
    const entityRef = `component:default/${service}`.toLowerCase();
    await this.store.upsertTargets(entityRef, targets);
  }

  private buildHistoryMap(dailyRows: any[], pastDate: Date, days: number) {
    const historyMap: any = { freq: [], lead: [], fail: [], mttr: [] };

    for (let i = 0; i < days; i++) {
      const d = new Date(pastDate);
      d.setDate(d.getDate() + i + 1);
      const dateStr = d.toISOString().split('T')[0];

      const row = dailyRows.find((r: any) => {
        const rowDate = typeof r.date === 'string' ? r.date : r.date.toISOString().split('T')[0];
        return rowDate === dateStr;
      });

      const deployCount = Number(row?.deployment_count || 0);
      const failCount = Number(row?.deployment_failure_count || 0);
      const leadSec = Number(row?.lead_time_avg_seconds || 0);
      const mttrSec = Number(row?.mttr_avg_seconds || 0);

      historyMap.freq.push(deployCount);
      historyMap.lead.push(Math.round(leadSec / 3600)); // hours
      historyMap.fail.push(deployCount > 0 ? Math.round((failCount / deployCount) * 100) : 0); // %
      historyMap.mttr.push(Math.round(mttrSec / 60)); // minutes
    }

    return historyMap;
  }

  private parseMetrics(row: any) {
    return {
      deploy: Number(row?.total_deploy || 0),
      fail: Number(row?.total_fail || 0),
      lead: Number(row?.lead || 0),
      mttr: Number(row?.mttr || 0),
    };
  }

  private calculateMetric(val: number, failCount: number, type: 'freq' | 'lead' | 'fail' | 'mttr', days: number = 30): number {
    let finalVal = 0;
    if (type === 'freq') finalVal = (val / days) * 7; // per week
    else if (type === 'fail') finalVal = val > 0 ? (failCount / val) * 100 : 0; // percentage
    else if (type === 'lead') finalVal = val / 3600; // hours
    else if (type === 'mttr') finalVal = val / 60; // minutes
    return Math.round(finalVal * 10) / 10;
  }

  private buildMetricData(
    currentVal: number,
    previousVal: number,
    target: number,
    metricName: string,
    historyData: number[]
  ): MetricData {
    const tier = this.getTier(metricName, currentVal);
    let change = 0;
    if (previousVal > 0) change = ((currentVal - previousVal) / previousVal) * 100;
    else if (currentVal > 0) change = 100;

    return {
      current: currentVal,
      previous: previousVal,
      change: Math.round(change * 10) / 10,
      target,
      tier,
      history: historyData
    };
  }

  private getTier(metric: string, value: number): string {
    const thresholds = {
      deploymentFrequency: { Elite: 7, High: 1, Medium: 0.25 },
      leadTime: { Elite: 24, High: 168, Medium: 720 },
      changeFailureRate: { Elite: 5, High: 15, Medium: 30 },
      mttr: { Elite: 60, High: 1440, Medium: 10080 },
    }[metric] as any;

    if (!thresholds) return 'Low';

    if (metric === 'deploymentFrequency') {
      return value >= thresholds.Elite ? 'Elite' : value >= thresholds.High ? 'High' : value >= thresholds.Medium ? 'Medium' : 'Low';
    } else {
      return value <= thresholds.Elite ? 'Elite' : value <= thresholds.High ? 'High' : value <= thresholds.Medium ? 'Medium' : 'Low';
    }
  }

  private calculateOverallScore(metrics: any): number {
    const scoreMap: Record<string, number> = { Elite: 100, High: 75, Medium: 50, Low: 25 };
    return (
      scoreMap[metrics.deploymentFrequency.tier] +
      scoreMap[metrics.leadTime.tier] +
      scoreMap[metrics.changeFailureRate.tier] +
      scoreMap[metrics.mttr.tier]
    ) / 4;
  }

  private getOverallTier(score: number): string {
    return score >= 75 ? 'Elite' : score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low';
  }
}
