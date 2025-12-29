# DORA Metrics Plugin (Backend)

Backend plugin for collecting and serving DORA (DevOps Research and Assessment) metrics.

## Features

- **Automated Data Collection**: Fetches deployment, PR, and issue data from GitHub every 30 minutes
- **Incremental Sync**: Only fetches new data since last sync for efficiency
- **4 Key Metrics**:
  - Deployment Frequency (per week)
  - Lead Time for Changes (hours)
  - Change Failure Rate (%)
  - Mean Time to Recovery (minutes)
- **REST API**: Provides scorecard and target management endpoints
- **PostgreSQL Storage**: Stores daily metrics and custom targets

## Installation

```bash
# From the root of your Backstage repo
yarn --cwd plugins/dora-metrics-backend install
```

## Configuration

### app-config.yaml

Add the following configuration to your `app-config.yaml`:

```yaml
doraMetrics:
  # GitHub configuration
  github:
    # List of GitHub organizations to monitor
    organizations:
      - your-org-name
    # GitHub Personal Access Token (can also be set via GITHUB_TOKEN env var)
    token: ${GITHUB_TOKEN}

  # Environment name mappings
  environments:
    production:
      - prd
      - prod
      - production
    staging:
      - stg
      - stage
      - staging

  # Label for failure/incident issues
  labels:
    failureIssue: bug

  # Data collection settings
  collection:
    # Sync interval in minutes (default: 30)
    intervalMinutes: 30
    # Initial data fetch period in days (default: 30)
    initialDays: 30
    # Optional: Only include specific services (empty = all services)
    includeServices: []
    # Optional: Exclude specific services
    excludeServices: []

  # Default target values for DORA metrics
  targets:
    deploymentFrequency: 7  # deployments per week
    leadTime: 24            # hours
    changeFailureRate: 5    # percentage
    mttr: 60                # minutes
```

### Environment Variables

```bash
# GitHub Personal Access Token (required)
GITHUB_TOKEN=ghp_xxxxx
```

### Minimal Configuration

At minimum, you only need to configure your GitHub organization:

```yaml
doraMetrics:
  github:
    organizations:
      - your-org-name
```

All other settings have sensible defaults.

## Usage

### Register the Plugin

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... other plugins ...

backend.add(import('@internal/plugin-dora-metrics-backend'));

backend.start();
```

## API Endpoints

### GET /api/dora/scorecard/:service

Get DORA metrics scorecard for a service.

**Parameters:**
- `service` (path): Service name (e.g., `globalone-service`)
- `days` (query, optional): Number of days to analyze (default: 30)

**Response:**
```json
{
  "service": "globalone-service",
  "period": "30 days",
  "metrics": {
    "deploymentFrequency": {
      "current": 14.2,
      "previous": 12.5,
      "change": 13.6,
      "target": 7,
      "tier": "Elite",
      "history": [1, 2, 1, 3, ...]
    },
    ...
  },
  "overallScore": 85,
  "overallTier": "Elite"
}
```

### POST /api/dora/targets/:service

Update targets for a service.

**Request Body:**
```json
{
  "deploymentFrequency": 7,
  "leadTime": 24,
  "changeFailureRate": 5,
  "mttr": 60
}
```

## Database Schema

### dora_daily_metrics

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| entity_ref | string | Service identifier (e.g., `component:default/service-name`) |
| date | date | Metric date (YYYY-MM-DD) |
| deployment_count | int | Number of deployments |
| deployment_failure_count | int | Number of failed deployments |
| lead_time_avg_seconds | int | Average lead time in seconds |
| mttr_avg_seconds | int | Average MTTR in seconds |
| updated_at | timestamp | Last update timestamp |

**Indexes:**
- Unique constraint on `(entity_ref, date)`
- Index on `date`
- Index on `entity_ref`

### dora_targets

| Column | Type | Description |
|--------|------|-------------|
| entity_ref | string | Service identifier (Primary key) |
| target_freq | float | Target deployment frequency (per week) |
| target_lead | float | Target lead time (hours) |
| target_fail | float | Target failure rate (%) |
| target_mttr | float | Target MTTR (minutes) |
| updated_at | timestamp | Last update timestamp |

## Data Collection

The plugin automatically:
1. Fetches services from the Backstage catalog
2. Filters services based on:
   - Must have a GitHub repository annotation (`github.com/project-slug` or `backstage.io/source-location`)
   - Repository must belong to one of the configured organizations
   - Optional: Apply `includeServices` or `excludeServices` filters
3. Queries GitHub GraphQL API for deployments (production environments only)
4. Queries GitHub REST API for merged PRs and closed issues
5. Calculates daily metrics for each service
6. Stores in PostgreSQL with upsert logic (updates existing records)

**Service Discovery**: The plugin discovers services automatically from your Backstage catalog. Services must have a GitHub repository annotation like:

```yaml
metadata:
  annotations:
    github.com/project-slug: your-org/your-repo
```

or

```yaml
metadata:
  annotations:
    backstage.io/source-location: url:https://github.com/your-org/your-repo
```

## Development

```bash
# Run tests
yarn test

# Build the plugin
yarn build

# Lint
yarn lint
```

## Architecture

```
src/
├── plugin.ts                    # Backstage plugin registration
├── types.ts                     # Type definitions
├── service/
│   ├── router.ts               # Express routes
│   ├── DoraMetricsService.ts   # Business logic
│   └── GitHubCollector.ts      # Data collection scheduler
└── database/
    └── DoraMetricsStore.ts     # Database access layer
```

## License

Apache-2.0
