# DORA Scorecard Plugin (Frontend)

Frontend plugin for rendering DORA metrics in Backstage service pages.

## Install

```bash
yarn add --cwd packages/app @jikwan/backstage-plugin-dora-scorecard
```

## Required Setup

### 1) Register the plugin in `App.tsx`

```tsx
// packages/app/src/App.tsx
import { createApp } from '@backstage/app-defaults';
import { doraMetricsPlugin } from '@jikwan/backstage-plugin-dora-scorecard';

const app = createApp({
  // ...other options
  plugins: [doraMetricsPlugin],
});
```

If this is missing, `DoraScorecard` can fail with:
`No implementation available for apiRef{plugin.dora-metrics.service}`.

### 2) Add `DoraScorecard` to an entity page

```tsx
// packages/app/src/components/catalog/EntityPage.tsx
import { DoraScorecard } from '@jikwan/backstage-plugin-dora-scorecard';

const serviceEntityPage = (
  <EntityLayout>
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

## Backend Dependency

This frontend plugin requires `@jikwan/backstage-plugin-dora-scorecard-backend` to be installed and configured.

## Exports

- `DoraScorecard`
- `doraMetricsPlugin`
- `doraMetricsApiRef`
- `DoraMetricsApi` (type)

## License

Apache-2.0
