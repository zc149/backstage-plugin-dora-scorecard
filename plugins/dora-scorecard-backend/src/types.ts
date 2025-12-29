/**
 * DORA Metrics Backend Types
 *
 * Note: Frontend has similar types but duplicated to maintain plugin independence.
 */

export interface MetricItem {
  created_at: string;
  conclusion: string; // 'success' | 'failure' | 'pending'
}

export interface GitHubPullRequest {
  merged_at: string | null;
  created_at: string;
}

export interface GitHubIssue {
  created_at: string;
  closed_at: string | null;
}

export interface GraphQlDeploymentResponse {
  data: {
    repository: {
      deployments: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string;
        };
        nodes: {
          id: string;
          createdAt: string;
          environment: string;
          statuses: {
            nodes: {
              state: string; // 'SUCCESS', 'FAILURE', 'ERROR', etc.
            }[];
          };
        }[];
      };
    };
  };
}

export interface MetricData {
  current: number;
  previous: number;
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

export interface ScorecardResponse {
  service: string;
  period: string;
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

export interface DailyMetrics {
  deploymentCount: number;
  failureCount: number;
  leadTime: number; // seconds
  mttr: number; // seconds
}

export interface GitHubData {
  deployments: MetricItem[];
  prs: GitHubPullRequest[];
  issues: GitHubIssue[];
}
