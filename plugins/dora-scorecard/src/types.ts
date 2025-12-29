/**
 * DORA Metrics Frontend Types
 *
 * Note: These types are duplicated in the backend plugin.
 * This is intentional to maintain plugin independence.
 */

export interface MetricData {
  current: number;
  change: number;
  target: number;
  tier: string;
  history: number[];
}

export interface DoraMetrics {
  deploymentFrequency: MetricData;
  leadTime: MetricData;
  changeFailureRate: MetricData;
  mttr: MetricData;
}

export interface DoraResponse {
  metrics: DoraMetrics;
  overallScore: number;
  overallTier: string;
}

export interface TargetsPayload {
  deploymentFrequency: number;
  leadTime: number;
  changeFailureRate: number;
  mttr: number;
}
