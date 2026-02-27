# DORA Scorecard Plugin (Backend)

Backend plugin that collects DORA metrics from GitHub and serves them to the frontend.

## Install

```bash
yarn add --cwd packages/backend @jikwan/backstage-plugin-dora-scorecard-backend
```

## Register in Backend

```ts
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

backend.add(import('@jikwan/backstage-plugin-dora-scorecard-backend'));

backend.start();
```

## Configuration

Add to `app-config.yaml`.

### Option 1: Personal Access Token

```yaml
doraMetrics:
  github:
    organizations:
      - your-org-name
    token: ${GITHUB_TOKEN}

  environments:
    production:
      - prd
      - prod
      - production

  labels:
    failureIssue: bug

  collection:
    intervalMinutes: 30
    initialDays: 30
    includeServices: []
    excludeServices: []
```

### Option 2: GitHub App

```yaml
integrations:
  github:
    - host: github.com
      apps:
        - appId: ${GITHUB_APP_ID}
          clientId: ${GITHUB_APP_CLIENT_ID}
          clientSecret: ${GITHUB_APP_CLIENT_SECRET}
          privateKey: |
            ${GITHUB_APP_PRIVATE_KEY}

doraMetrics:
  github:
    organizations:
      - your-org-name

  environments:
    production:
      - prd
      - prod
      - production

  labels:
    failureIssue: bug

  collection:
    intervalMinutes: 30
    initialDays: 30
    includeServices: []
    excludeServices: []
```

## Service Requirements

Catalog entities must include one of these annotations:

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

## API

The plugin ID is `dora-metrics`, so clients should use Backstage discovery:

- `GET {baseUrl}/scorecard/:service?days=30`
- `POST {baseUrl}/targets/:service`

Example `baseUrl` in default Backstage setup is typically `/api/dora-metrics`.

## Notes

- Database migrations run automatically on startup.
- Data sync runs on startup and then at `collection.intervalMinutes`.

## License

Apache-2.0
