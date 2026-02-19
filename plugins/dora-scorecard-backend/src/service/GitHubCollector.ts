import { Logger } from 'winston';
import { CatalogClient } from '@backstage/catalog-client';
import { AuthService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { DoraMetricsStore } from '../database/DoraMetricsStore';
import { GithubClient } from './GithubClient';
import {
  MetricItem,
  GitHubPullRequest,
  GitHubIssue,
  GitHubData,
  GraphQlDeploymentResponse,
  DailyMetrics,
} from '../types';

interface GitHubCollectorConfig {
  organizations: string[];
  productionEnvironments: string[];
  failureIssueLabel: string;
  intervalMinutes: number;
  initialDays: number;
  includeServices: string[];
  excludeServices: string[];
}

export class GitHubCollector {
  private readonly logger: Logger;
  private readonly catalogClient: CatalogClient;
  private readonly auth: AuthService;
  private readonly store: DoraMetricsStore;
  private readonly config: GitHubCollectorConfig;
  private readonly githubClient: GithubClient;
  private isRunning: boolean = false;

  constructor(options: {
    logger: Logger;
    catalogClient: CatalogClient;
    auth: AuthService;
    store: DoraMetricsStore;
    config: Config;
    githubClient: GithubClient;
  }) {
    this.logger = options.logger;
    this.catalogClient = options.catalogClient;
    this.auth = options.auth;
    this.store = options.store;
    this.githubClient = options.githubClient;
    this.config = this.loadConfig(options.config);

    this.logger.info(`[DORA] Configuration loaded:`, {
      organizations: this.config.organizations,
      environments: this.config.productionEnvironments,
      intervalMinutes: this.config.intervalMinutes,
    });
  }

  private loadConfig(config: Config): GitHubCollectorConfig {
    const doraConfig = config.getOptionalConfig('doraMetrics');

    return {
      organizations: doraConfig?.getOptionalStringArray('github.organizations') || [],
      productionEnvironments: doraConfig?.getOptionalStringArray('environments.production') || ['prd', 'prod', 'production'],
      failureIssueLabel: doraConfig?.getOptionalString('labels.failureIssue') || 'bug',
      intervalMinutes: doraConfig?.getOptionalNumber('collection.intervalMinutes') || 30,
      initialDays: doraConfig?.getOptionalNumber('collection.initialDays') || 30,
      includeServices: doraConfig?.getOptionalStringArray('collection.includeServices') || [],
      excludeServices: doraConfig?.getOptionalStringArray('collection.excludeServices') || [],
    };
  }

  async start() {
    if (this.isRunning) return;

    // Initialize GitHub authentication
    try {
      await this.githubClient.initializeToken();
    } catch (error) {
      this.logger.error(`[DORA] ${error}`);
      return;
    }

    if (this.config.organizations.length === 0) {
      this.logger.warn('[DORA] No GitHub organizations configured. Add doraMetrics.github.organizations to app-config');
      return;
    }

    this.isRunning = true;
    this.logger.info('[DORA] Scheduler STARTING...');

    // Initial sync
    this.syncAllServices();

    // Run periodically
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    setInterval(() => {
      this.syncAllServices();
    }, intervalMs);
  }

  private async syncAllServices() {
    this.logger.info(`🔍 [DORA] Sync started...`);
    try {
      const { token } = await this.auth.getPluginRequestToken({
        onBehalfOf: await this.auth.getOwnServiceCredentials(),
        targetPluginId: 'catalog',
      });

      const { items } = await this.catalogClient.getEntities({
        filter: { kind: 'Component', 'spec.type': 'service' },
        fields: ['metadata.name', 'metadata.annotations'],
      }, { token });

      let services = items.map(item => ({
        name: item.metadata.name,
        githubRepo: this.extractGitHubRepo(item.metadata.annotations),
      }));

      // Apply filters
      services = services.filter(({ name, githubRepo }) => {
        // Must have GitHub repo
        if (!githubRepo) return false;

        // Check include list (if configured)
        if (this.config.includeServices.length > 0) {
          if (!this.config.includeServices.includes(name)) return false;
        }

        // Check exclude list
        if (this.config.excludeServices.includes(name)) return false;

        // Check if repo belongs to configured organizations
        const [org] = githubRepo.split('/');
        return this.config.organizations.includes(org);
      });

      this.logger.info(`[DORA] Found ${services.length} services to process`);

      for (const service of services) {
        await this.processService(service.name, service.githubRepo!);
        await this.delay(3000);
      }
    } catch (error) {
      this.logger.error(`[DORA] Catalog Fetch Error: ${error}`);
    }
  }

  private extractGitHubRepo(annotations: any): string | null {
    // Standard Backstage annotation
    const repoUrl = annotations?.['github.com/project-slug'];
    if (repoUrl) return repoUrl;

    // Fallback to source location
    const sourceLocation = annotations?.['backstage.io/source-location'];
    if (sourceLocation) {
      const match = sourceLocation.match(/github\.com\/([^/]+\/[^/]+)/);
      if (match) return match[1];
    }

    return null;
  }

  private async processService(service: string, githubRepo: string) {
    const entityRef = `component:default/${service}`.toLowerCase();
    this.logger.info(`[DORA] Processing Service: ${service} (${githubRepo})`);

    try {
      const lastSyncDate = await this.store.getLastSyncDate(entityRef);

      const since = lastSyncDate
        ? new Date(new Date(lastSyncDate).setDate(new Date(lastSyncDate).getDate() - 1))
        : new Date(new Date().setDate(new Date().getDate() - this.config.initialDays));

      this.logger.info(`[DORA] Fetching data for ${service} since ${since.toISOString().split('T')[0]}`);

      const rawData = await this.fetchAllGitHubData(githubRepo, since);

      this.logger.info(`[DORA] New Data for ${service}: Deployments=${rawData.deployments.length}, PRs=${rawData.prs.length}`);

      const today = new Date();
      const loopDate = new Date(since);

      while (loopDate <= today) {
        const dateStr = `${loopDate.getFullYear()}-${String(loopDate.getMonth() + 1).padStart(2, '0')}-${String(loopDate.getDate()).padStart(2, '0')}`;
        const metrics = this.calculateDailyMetrics(rawData, dateStr);
        await this.store.upsertDailyMetrics(entityRef, dateStr, metrics);
        loopDate.setDate(loopDate.getDate() + 1);
      }

      this.logger.info(`[DORA] Sync Complete for ${service}`);

    } catch (error) {
      this.logger.error(`[DORA] Process Error for ${service}: ${error}`);
    }
  }

  private async fetchAllGitHubData(githubRepo: string, since: Date): Promise<GitHubData> {
    const [org, repo] = githubRepo.split('/');

    const deployments = await this.fetchDeploymentsGraphQL(org, repo, since);

    const prs = await this.fetchPagedRestData<GitHubPullRequest>(
      `https://api.github.com/repos/${githubRepo}/pulls?state=closed&base=main`,
      (pr) => pr.merged_at !== null && new Date(pr.merged_at) > since
    );

    const issues = await this.fetchPagedRestData<GitHubIssue>(
      `https://api.github.com/repos/${githubRepo}/issues?labels=${this.config.failureIssueLabel}&state=closed`,
      (i) => i.closed_at !== null && new Date(i.closed_at) > since
    );

    return { deployments, prs, issues };
  }

  private async fetchDeploymentsGraphQL(org: string, repo: string, since: Date): Promise<MetricItem[]> {
    const results: MetricItem[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    // Build environments filter for GraphQL
    const environments = this.config.productionEnvironments;

    const query = `
      query($owner: String!, $repo: String!, $environments: [String!]!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          deployments(environments: $environments, first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              createdAt
              statuses(first: 1) {
                nodes {
                  state
                }
              }
            }
          }
        }
      }
    `;

    while (hasNextPage) {
      try {
        const response: GraphQlDeploymentResponse = await this.githubClient.fetchGraphQL<GraphQlDeploymentResponse>(query, {
          owner: org,
          repo: repo,
          environments: environments,
          cursor: cursor
        });

        const repoData = response.data?.repository;
        if (!repoData || !repoData.deployments) {
          break;
        }

        const data = repoData.deployments;

        for (const node of data.nodes) {
          if (new Date(node.createdAt) < since) {
            hasNextPage = false;
            break;
          }

          const state = node.statuses.nodes[0]?.state;
          const conclusion = (state === 'SUCCESS')
            ? 'success'
            : (state === 'FAILURE' || state === 'ERROR') ? 'failure' : 'pending';

          results.push({
            created_at: node.createdAt,
            conclusion: conclusion
          });
        }

        if (hasNextPage && data.pageInfo.hasNextPage) {
          cursor = data.pageInfo.endCursor;
          await this.delay(200);
        } else {
          hasNextPage = false;
        }

      } catch (e) {
        this.logger.warn(`[DORA] GraphQL Fetch Error: ${e}`);
        hasNextPage = false;
      }
    }
    return results;
  }

  private async fetchPagedRestData<T>(baseUrl: string, filterFn: (item: T) => boolean): Promise<T[]> {
    let page = 1;
    let allResults: T[] = [];
    let hasMore = true;

    while (hasMore) {
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}per_page=100&page=${page}`;
      try {
        const data = await this.githubClient.fetchREST<T[]>(url);

        if (!Array.isArray(data) || data.length === 0) {
          hasMore = false;
        } else {
          const validItems = data.filter(filterFn);
          allResults.push(...validItems);

          if (data.length < 100) hasMore = false;
          else page++;
        }
        await this.delay(100);
      } catch (error) {
        this.logger.warn(`[DORA] REST Fetch Error on page ${page}: ${error}`);
        hasMore = false;
      }
    }
    return allResults;
  }

  private calculateDailyMetrics(raw: GitHubData, dateStr: string): DailyMetrics {
    const dailyDeployments = raw.deployments.filter((d: MetricItem) => d.created_at.startsWith(dateStr));
    const deploymentCount = dailyDeployments.length;
    const failureCount = dailyDeployments.filter((d: MetricItem) => d.conclusion === 'failure').length;

    const dailyPrs = raw.prs.filter((pr: any) => pr.merged_at && pr.merged_at.startsWith(dateStr));
    let leadTime = 0;
    if (dailyPrs.length > 0) {
      const total = dailyPrs.reduce((sum: number, pr: any) => sum + (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 1000, 0);
      leadTime = Math.round(total / dailyPrs.length);
    }

    const dailyIssues = raw.issues.filter((i: any) => i.closed_at && i.closed_at.startsWith(dateStr));
    let mttr = 0;
    if (dailyIssues.length > 0) {
      const total = dailyIssues.reduce((sum: number, i: any) => sum + (new Date(i.closed_at).getTime() - new Date(i.created_at).getTime()) / 1000, 0);
      mttr = Math.round(total / dailyIssues.length);
    }

    return { deploymentCount, failureCount, leadTime, mttr };
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
