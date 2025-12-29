import { Knex } from 'knex';
import { DailyMetrics } from '../types';

export class DoraMetricsStore {
  constructor(private readonly database: Knex) {}

  async getMetricsForPeriod(entityRef: string, startDate: Date, endDate: Date) {
    return this.database('dora_daily_metrics')
      .where('entity_ref', entityRef)
      .andWhereBetween('date', [startDate, endDate])
      .sum('deployment_count as total_deploy')
      .sum('deployment_failure_count as total_fail')
      .avg('lead_time_avg_seconds as lead')
      .avg('mttr_avg_seconds as mttr')
      .first();
  }

  async getDailyHistory(entityRef: string, startDate: Date, endDate: Date) {
    return this.database('dora_daily_metrics')
      .where('entity_ref', entityRef)
      .andWhereBetween('date', [startDate, endDate])
      .orderBy('date', 'asc')
      .select('date', 'deployment_count', 'deployment_failure_count', 'lead_time_avg_seconds', 'mttr_avg_seconds');
  }

  async getTargets(entityRef: string) {
    return this.database('dora_targets')
      .where('entity_ref', entityRef)
      .first();
  }

  async upsertTargets(entityRef: string, targets: {
    deploymentFrequency: number;
    leadTime: number;
    changeFailureRate: number;
    mttr: number;
  }) {
    await this.database('dora_targets')
      .insert({
        entity_ref: entityRef,
        target_freq: targets.deploymentFrequency,
        target_lead: targets.leadTime,
        target_fail: targets.changeFailureRate,
        target_mttr: targets.mttr,
        updated_at: this.database.fn.now()
      })
      .onConflict('entity_ref')
      .merge();
  }

  async upsertDailyMetrics(entityRef: string, dateStr: string, metrics: DailyMetrics) {
    await this.database('dora_daily_metrics')
      .insert({
        entity_ref: entityRef,
        date: dateStr,
        deployment_count: metrics.deploymentCount,
        deployment_failure_count: metrics.failureCount,
        lead_time_avg_seconds: metrics.leadTime,
        mttr_avg_seconds: metrics.mttr,
      })
      .onConflict(['entity_ref', 'date'])
      .merge();
  }

  async getLastSyncDate(entityRef: string): Promise<string | null> {
    const result = await this.database('dora_daily_metrics')
      .where('entity_ref', entityRef)
      .max('date as lastDate')
      .first();
    return result?.lastDate || null;
  }
}
