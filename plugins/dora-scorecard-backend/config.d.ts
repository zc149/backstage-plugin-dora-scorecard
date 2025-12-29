export interface Config {
  doraMetrics?: {
    /**
     * GitHub configuration
     */
    github?: {
      /**
       * GitHub organizations to monitor
       * @visibility backend
       */
      organizations?: string[];

      /**
       * GitHub personal access token
       * @visibility secret
       */
      token?: string;
    };

    /**
     * Default target values for DORA metrics
     */
    targets?: {
      /**
       * Deployment frequency target (deployments per week)
       * @default 1
       */
      deploymentFrequency?: number;

      /**
       * Lead time target (hours)
       * @default 24
       */
      leadTime?: number;

      /**
       * Change failure rate target (percentage)
       * @default 5
       */
      changeFailureRate?: number;

      /**
       * Mean time to recovery target (minutes)
       * @default 60
       */
      mttr?: number;
    };

    /**
     * Environment name mappings
     */
    environments?: {
      /**
       * Production environment names
       * @default ["prd", "prod", "production"]
       */
      production?: string[];

      /**
       * Staging environment names
       * @default ["stg", "stage", "staging"]
       */
      staging?: string[];
    };

    /**
     * Label mappings for GitHub issues
     */
    labels?: {
      /**
       * Label for failure/incident issues
       * @default "bug"
       */
      failureIssue?: string;
    };

    /**
     * Data collection settings
     */
    collection?: {
      /**
       * Sync interval in minutes
       * @default 30
       */
      intervalMinutes?: number;

      /**
       * Initial data fetch period in days
       * @default 30
       */
      initialDays?: number;

      /**
       * Services to include (if empty, all services are included)
       */
      includeServices?: string[];

      /**
       * Services to exclude
       */
      excludeServices?: string[];
    };
  };
}
