import { Config } from '@backstage/config';
import { Logger } from 'winston';
import { ScmIntegrations, DefaultGithubCredentialsProvider } from '@backstage/integration';
import fetch from 'node-fetch';

interface GithubClientConfig {
  token: string;
  hostname: string;
  organizations: string[];
}

interface GithubClientOptions {
  logger: Logger;
  config: Config;
}

const TOKEN_CONFIG = {
  GITHUB_APP_TOKEN_LIFETIME_MS: 60 * 60 * 1000,
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000,
} as const;

const GITHUB_API = {
  GRAPHQL_ENDPOINT: 'https://api.github.com/graphql',
  DEFAULT_HOSTNAME: 'github.com',
} as const;

export class GithubClient {
  private readonly logger: Logger;
  private readonly config: GithubClientConfig;
  private readonly scmIntegrations: ScmIntegrations;
  private readonly credentialsProvider: DefaultGithubCredentialsProvider;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(options: GithubClientOptions) {
    this.logger = options.logger;
    this.scmIntegrations = ScmIntegrations.fromConfig(options.config);
    this.credentialsProvider =
      DefaultGithubCredentialsProvider.fromIntegrations(this.scmIntegrations);
    this.config = this.parseConfig(options.config);
  }

  async initializeToken(): Promise<void> {
    try {
      await this.getToken();
      this.logger.info('[DORA] GitHub authentication validated successfully');
    } catch (error) {
      this.logger.error(
        '[DORA] Failed to initialize GitHub authentication',
        error,
      );
      throw error;
    }
  }

  // Parse and validate GitHub configuration from Backstage config.
  private parseConfig(config: Config): GithubClientConfig {
    const doraConfig = config.getOptionalConfig('doraMetrics');

    return {
      token:
        doraConfig?.getOptionalString('github.token') ||
        process.env.GITHUB_TOKEN ||
        '',
      hostname: GITHUB_API.DEFAULT_HOSTNAME,
      organizations:
        doraConfig?.getOptionalStringArray('github.organizations') || [],
    };
  }

  // Get a valid GitHub authentication token with automatic caching and refresh.
  private async getToken(): Promise<string> {
    if (this.config.token) {
      return this.config.token;
    }

    return this.getOrRefreshAppToken();
  }

  // Get or refresh the GitHub App installation token with caching.
  private async getOrRefreshAppToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedToken && now < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    if (!this.isGitHubAppConfigured()) {
      throw new Error(
        'GitHub authentication is not configured. ' +
          'Please configure one of the following: ' +
          '1) Set GITHUB_TOKEN environment variable, ' +
          '2) Set doraMetrics.github.token in config, ' +
          '3) Configure a GitHub App under integrations.github.apps',
      );
    }

    try {
      this.cachedToken = await this.generateGitHubAppToken();
      const validityDurationMs =
        TOKEN_CONFIG.GITHUB_APP_TOKEN_LIFETIME_MS -
        TOKEN_CONFIG.TOKEN_REFRESH_BUFFER_MS;
      this.tokenExpiresAt = now + validityDurationMs;

      this.logger.info(
        `[DORA] GitHub App token generated and cached (valid for ${validityDurationMs / 60000} minutes)`,
      );

      return this.cachedToken;
    } catch (error) {
      this.logger.error('[DORA] Failed to generate GitHub App token', error);
      throw error;
    }
  }

  // Check if a GitHub App is configured in the integrations.
  private isGitHubAppConfigured(): boolean {
    const githubIntegration = this.scmIntegrations.github.byHost(
      this.config.hostname,
    );
    return (
      githubIntegration?.config.apps !== undefined &&
      githubIntegration.config.apps.length > 0
    );
  }

  // Generate a new GitHub App installation token using Backstage's credentials provider.
  private async generateGitHubAppToken(): Promise<string> {
    if (!this.config.organizations || this.config.organizations.length === 0) {
      throw new Error(
        'No organizations configured in doraMetrics.github.organizations. ' +
          'GitHub App authentication requires at least one organization.',
      );
    }

    const organization = this.config.organizations[0];
    const url = `https://${this.config.hostname}/${organization}`;

    try {
      const credentials = await this.credentialsProvider.getCredentials({
        url,
      });

      if (!credentials?.token) {
        throw new Error(
          `Failed to obtain token for ${url}. ` +
            `Ensure the GitHub App is installed on organization: ${organization}`,
        );
      }

      return credentials.token;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `GitHub App authentication failed for organization "${organization}". ` +
          `Verify integrations.github.apps configuration and app installation. ` +
          `Details: ${errorMessage}`,
      );
    }
  }

  // Execute a GraphQL query against the GitHub API.
  async fetchGraphQL<T>(query: string, variables: any): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(GITHUB_API.GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorMessage = `GitHub GraphQL request failed with status ${response.status}: ${response.statusText}`;
      this.logger.error('[DORA]', errorMessage);
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  // Execute a REST API request against the GitHub API.
  async fetchREST<T>(url: string): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, { headers });

    if (response.status === 403) {
      const resetTime = response.headers.get('x-ratelimit-reset');
      const errorMessage = `GitHub rate limit exceeded. Resets at: ${resetTime}`;
      this.logger.error('[DORA]', errorMessage);
      throw new Error(errorMessage);
    }

    if (!response.ok) {
      const errorMessage = `GitHub REST API request failed with status ${response.status}: ${response.statusText}`;
      this.logger.error('[DORA]', errorMessage);
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }
}
