import {
  createPlugin,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { doraMetricsApiRef, DoraMetricsClient } from './api/DoraMetricsClient';

export const doraMetricsPlugin = createPlugin({
  id: 'dora-metrics',
  apis: [
    createApiFactory({
      api: doraMetricsApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new DoraMetricsClient(discoveryApi, fetchApi),
    }),
  ],
});
