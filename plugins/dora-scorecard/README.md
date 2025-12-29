# DORA Metrics Plugin (Frontend)

Frontend plugin for visualizing DORA (DevOps Research and Assessment) metrics in Backstage.

## Features

- **Interactive Scorecard**: Visual representation of all 4 DORA metrics with performance tiers
- **Historical Trends**: Sparkline charts showing metric trends over time
- **Custom Targets**: Set and track custom performance targets per service
- **Performance Tiers**: Color-coded Elite, High, Medium, Low classification
- **Progress Tracking**: Visual progress bars showing goal attainment

## Installation

```bash
# From the root of your Backstage repo
yarn add --cwd packages/app @jikwan/backstage-plugin-dora-scorecard
```

## Configuration

### Add to Entity Page

Add the DORA Metrics card to your service entity page:

```typescript
// packages/app/src/components/catalog/EntityPage.tsx
import { DoraScorecard } from '@jikwan/backstage-plugin-dora-scorecard';

const serviceEntityPage = (
  <EntityLayout>
    {/* ... other tabs ... */}
    <EntityLayout.Route path="/dora" title="DORA Metrics">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <DoraScorecard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);
```

## Usage

The DORA Scorecard component automatically displays metrics for the current service entity. It fetches data from the backend plugin and displays:

- **Deployment Frequency**: Number of deployments per week
- **Lead Time**: Average time from commit to production (hours)
- **Change Failure Rate**: Percentage of deployments causing failures
- **MTTR**: Mean time to recovery from failures (minutes)

### Setting Custom Targets

Click the "Targets" button to set custom performance goals for each metric. These targets are used to calculate progress bars and determine if goals are met.

## Components

### DoraScorecard

Main component that displays the DORA metrics scorecard.

**Props**: None (uses entity context)

**Usage**:
```typescript
import { DoraScorecard } from '@jikwan/backstage-plugin-dora-scorecard';

<DoraScorecard />
```

## Performance Tiers

Metrics are classified into tiers based on DORA research benchmarks:

- **Elite**: Best-in-class performance (green)
- **High**: Strong performance (blue)
- **Medium**: Average performance (orange)
- **Low**: Below average performance (red)

## API

The plugin communicates with the backend via the following API client:

```typescript
import { doraMetricsApiRef } from '@jikwan/backstage-plugin-dora-scorecard';

// Get scorecard data
const scorecard = await doraMetricsApi.getScorecard(serviceName, days);

// Update targets
await doraMetricsApi.updateTargets(serviceName, {
  deploymentFrequency: 7,
  leadTime: 24,
  changeFailureRate: 5,
  mttr: 60
});
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

## License

Apache-2.0
