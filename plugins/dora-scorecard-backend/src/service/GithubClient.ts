import { Config } from '@backstage/config';
import { Logger } from 'winston';
import { ScmIntegrations, DefaultGithubCredentialsProvider } from '@backstage/integration';
import fetch from 'node-fetch';

interface GithubClientConfig {
  token: string;
  hostname: string;
  organizations: string[];
}

/**
 * GitHub API client with support for both Personal Access Token and GitHub App authentication
 */
export class GithubClient {
  private readonly logger: Logger;
  private readonly config: GithubClientConfig;
  private readonly scmIntegrations: ScmIntegrations;
  private readonly credentialsProvider: DefaultGithubCredentialsProvider;
  private githubToken: string = '';
  private tokenInitialized: boolean = false;

  constructor(options: {
    logger: Logger;
    config: Config;
  }) {
    this.logger = options.logger;
    this.scmIntegrations = ScmIntegrations.fromConfig(options.config);
    this.credentialsProvider = DefaultGithubCredentialsProvider.fromIntegrations(this.scmIntegrations);
    this.config = this.loadConfig(options.config);
  }

  private loadConfig(config: Config): GithubClientConfig {
    const doraConfig = config.getOptionalConfig('doraMetrics');

    return {
      token: doraConfig?.getOptionalString('github.token') || process.env.GITHUB_TOKEN || '',
      hostname: 'github.com',
      organizations: doraConfig?.getOptionalStringArray('github.organizations') || [],
    };
  }

  /**
   * Initialize and retrieve GitHub token
   * Priority: 1) doraMetrics.github.token, 2) GitHub App from integrations.github.apps
   */
  async initializeToken(): Promise<void> {
    if (this.tokenInitialized) {
      return;
    }

    if (this.config.token) {
      this.logger.info('[DORA] Using configured GitHub token from doraMetrics.github.token');
      this.githubToken = this.config.token;
      this.tokenInitialized = true;
      return;
    }

    const githubIntegration = this.scmIntegrations.github.byHost(this.config.hostname);
    const hasGitHubApp = githubIntegration?.config.apps && githubIntegration.config.apps.length > 0;

    if (hasGitHubApp) {
      this.logger.info('[DORA] Generating token from GitHub App (integrations.github.apps)');
      try {
        this.githubToken = await this.getGitHubAppToken();
        this.tokenInitialized = true;
        return;
      } catch (error) {
        this.logger.error(`[DORA] Failed to generate token from GitHub App: ${error}`);
        throw error;
      }
    }

    throw new Error('GitHub authentication is not configured. Please set the GITHUB_TOKEN environment variable, or provide a value for doraMetrics.github.token, or configure a GitHub App under integrations.github.apps');
  }

  /**
   * Get GitHub App installation token using Backstage's DefaultGithubCredentialsProvider
   * Reads from integrations.github.apps configuration
   */
  private async getGitHubAppToken(): Promise<string> {
    try {
      if (!this.config.organizations || this.config.organizations.length === 0) {
        throw new Error('No organizations configured in doraMetrics.github.organizations. GitHub App requires at least one organization.');
      }

      const organization = this.config.organizations[0];
      const url = `https://${this.config.hostname}/${organization}`;

      this.logger.info(`[DORA] Requesting credentials for organization: ${organization}`);

      const credentials = await this.credentialsProvider.getCredentials({
        url: url,
      });

      if (!credentials?.token) {
        throw new Error(`Failed to get token from GitHub credentials provider for ${url}. Ensure GitHub App is installed on organization: ${organization}`);
      }

      this.logger.info(`[DORA] Successfully generated token from GitHub App for organization: ${organization}`);

      return credentials.token;
    } catch (error) {
      this.logger.error(`[DORA] Error getting credentials from GitHub App: ${error}`);
      throw new Error(`GitHub App authentication failed. Check integrations.github.apps configuration and ensure app is installed on organization: ${error}`);
    }
  }

  /**
   * Make a GraphQL request to GitHub
   */
  async fetchGraphQL<T>(query: string, variables: any): Promise<T> {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.githubToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL Error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a REST API request to GitHub
   */
  async fetchREST<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };

    if (this.githubToken) {
      headers['Authorization'] = `Bearer ${this.githubToken}`;
    }

    const response = await fetch(url, { headers });

    if (response.status === 403) {
      const resetTime = response.headers.get('x-ratelimit-reset');
      throw new Error(`GitHub Rate Limit Exceeded. Reset at: ${resetTime}`);
    }

    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.status} - ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}
