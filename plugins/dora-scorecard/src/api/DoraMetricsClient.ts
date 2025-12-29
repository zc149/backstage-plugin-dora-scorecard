import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { DoraResponse, TargetsPayload } from '../types';

/**
 * API Reference for DORA Metrics
 * This is the contract that defines what operations are available
 */
export const doraMetricsApiRef = createApiRef<DoraMetricsApi>({
  id: 'plugin.dora-metrics.service',
});

/**
 * DORA Metrics API interface
 */
export interface DoraMetricsApi {
  getScorecard(serviceName: string, days: number): Promise<DoraResponse>;
  updateTargets(serviceName: string, targets: TargetsPayload): Promise<void>;
}

/**
 * Default implementation of DORA Metrics API
 */
export class DoraMetricsClient implements DoraMetricsApi {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  async getScorecard(serviceName: string, days: number = 30): Promise<DoraResponse> {
    const baseUrl = await this.discoveryApi.getBaseUrl('dora-metrics');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/scorecard/${serviceName}?days=${days}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch DORA scorecard: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async updateTargets(serviceName: string, targets: TargetsPayload): Promise<void> {
    const baseUrl = await this.discoveryApi.getBaseUrl('dora-metrics');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/targets/${serviceName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targets),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update targets: ${response.status} ${response.statusText}`);
    }
  }
}
