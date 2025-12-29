# Backstage DORA Scorecard Plugin

[![npm version](https://badge.fury.io/js/@jikwan%2Fbackstage-plugin-dora-scorecard.svg)](https://badge.fury.io/js/@jikwan%2Fbackstage-plugin-dora-scorecard)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A Backstage plugin for tracking and visualizing [DORA (DevOps Research and Assessment) metrics](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance) with an intuitive scorecard interface.

![DORA Scorecard Screenshot](./dora.png)

## Features

- **Automated Data Collection**: Collects deployment, PR, and incident data from GitHub automatically
- **4 Key DORA Metrics**:
  - **Deployment Frequency**: How often you deploy to production
  - **Lead Time for Changes**: Time from code commit to production
  - **Change Failure Rate**: Percentage of deployments causing failures
  - **Mean Time to Recovery (MTTR)**: Time to recover from failures
- **Performance Tiers**: Elite, High, Medium, Low classification based on DORA benchmarks
- **Historical Trends**: Track metrics over time with interactive charts
- **Scorecard Visualization**: Clean, intuitive UI showing current performance
- **Customizable Targets**: Set custom performance targets per service
- **Incremental Sync**: Efficient data collection with incremental updates
- **PostgreSQL Storage**: Persistent storage for long-term trend analysis

## Installation

### 1. Install the plugins

```bash
# From your Backstage root directory
yarn add --cwd packages/app @jikwan/backstage-plugin-dora-scorecard
yarn add --cwd packages/backend @jikwan/backstage-plugin-dora-scorecard-backend
```

### 2. Add the frontend plugin

```typescript
// packages/app/src/components/catalog/EntityPage.tsx
import { DoraMetricsCard } from '@jikwan/backstage-plugin-dora-scorecard';

// Add to your service entity page
const serviceEntityPage = (
  <EntityLayout>
    {/* ... other tabs ... */}
    <EntityLayout.Route path="/dora" title="DORA Metrics">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <DoraMetricsCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);
```

### 3. Add the backend plugin

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... other plugins ...

backend.add(import('@jikwan/backstage-plugin-dora-scorecard-backend'));

backend.start();
```

### 4. Configure the plugin

Add the following to your `app-config.yaml`:

```yaml
doraMetrics:
  # GitHub configuration
  github:
    # List of GitHub organizations to monitor
    organizations:
      - your-org-name
    # GitHub Personal Access Token (or set via GITHUB_TOKEN env var)
    token: ${GITHUB_TOKEN}

  # Environment name mappings
  environments:
    production:
      - prd
      - prod
      - production

  # Label for failure/incident issues
  labels:
    failureIssue: bug

  # Data collection settings
  collection:
    intervalMinutes: 30  # Sync interval
    initialDays: 30      # Initial data fetch period

  # Optional: Service filtering
  # collection:
  #   includeServices: [service-a, service-b]  # Only these services
  #   excludeServices: [test-service]          # Exclude these services
```

### 5. Set up environment variables

```bash
# GitHub Personal Access Token with the following scopes:
# - repo (Full control of private repositories)
# - read:org (Read org and team membership)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

## Requirements

- **Backstage**: >= 1.0.0
- **PostgreSQL**: Database for storing metrics
- **GitHub**: Currently supports GitHub as the data source
- **GitHub Annotations**: Services must have GitHub repository annotations in their `catalog-info.yaml`:

```yaml
metadata:
  annotations:
    github.com/project-slug: your-org/your-repo
    # OR
    backstage.io/source-location: url:https://github.com/your-org/your-repo
```

## How It Works

1. **Service Discovery**: Plugin automatically discovers services from your Backstage catalog
2. **Data Collection**: Every 30 minutes (configurable), the plugin:
   - Fetches deployment data from GitHub Deployments API
   - Collects merged Pull Requests
   - Gathers closed issues labeled as failures/bugs
3. **Metrics Calculation**: Calculates daily DORA metrics for each service
4. **Storage**: Stores metrics in PostgreSQL with upsert logic
5. **Visualization**: Frontend displays scorecard with current metrics, trends, and tier classification

## Configuration Options

### GitHub Organizations

Only repositories from specified organizations will be monitored:

```yaml
github:
  organizations:
    - org-1
    - org-2
```

### Production Environments

Define which GitHub deployment environments are considered "production":

```yaml
environments:
  production:
    - prd
    - prod
    - production
```

### Service Filtering

```yaml
collection:
  # Only collect metrics for these services (empty = all services)
  includeServices:
    - critical-service
    - payment-service

  # Exclude specific services
  excludeServices:
    - test-service
    - deprecated-service
```

### Custom Targets

```yaml
targets:
  deploymentFrequency: 7    # deployments per week
  leadTime: 24              # hours
  changeFailureRate: 5      # percentage
  mttr: 60                  # minutes
```

## API Endpoints

The backend plugin provides the following REST API endpoints:

- `GET /api/dora-scorecard/scorecard/:service?days=30` - Get DORA scorecard for a service
- `POST /api/dora-scorecard/targets/:service` - Update custom targets for a service
- `GET /api/dora-scorecard/health` - Health check endpoint

## Performance Tiers

Based on [DORA's State of DevOps research](https://cloud.google.com/blog/products/devops-sre/dora-2022-accelerate-state-of-devops-report-now-out):

| Metric | Elite | High | Medium | Low |
|--------|-------|------|--------|-----|
| Deployment Frequency | Multiple times per day | Once per day to once per week | Once per week to once per month | Less than once per month |
| Lead Time | Less than 1 hour | 1 day to 1 week | 1 week to 1 month | More than 1 month |
| Change Failure Rate | 0-5% | 6-10% | 11-15% | Over 15% |
| MTTR | Less than 1 hour | Less than 1 day | 1 day to 1 week | More than 1 week |

## Development

### Build

```bash
yarn install
yarn build
```

### Test

```bash
yarn test
```

### Lint

```bash
yarn lint
```

## Roadmap

- [ ] Support for GitLab as a data source
- [ ] Support for Bitbucket
- [ ] Custom deployment platforms (ArgoCD, Jenkins)
- [ ] Team-level aggregated metrics
- [ ] Slack notifications for tier changes
- [ ] Export metrics to external systems

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## Support

- [Report a bug](https://github.com/zc149/backstage-plugin-dora-scorecard/issues)
- [Request a feature](https://github.com/zc149/backstage-plugin-dora-scorecard/issues)
- [Documentation](https://github.com/zc149/backstage-plugin-dora-scorecard/blob/main/README.md)

## Acknowledgments

- Built for [Backstage](https://backstage.io/)
- Inspired by [DORA metrics research](https://www.devops-research.com/research.html)
- Uses [Google's Four Keys](https://github.com/GoogleCloudPlatform/fourkeys) methodology
