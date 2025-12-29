import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { createRouter } from './service/router';
import { GitHubCollector } from './service/GitHubCollector';
import { DoraMetricsStore } from './database/DoraMetricsStore';

export const doraMetricsPlugin = createBackendPlugin({
  pluginId: 'dora-metrics',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        database: coreServices.database,
        httpRouter: coreServices.httpRouter,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
        config: coreServices.rootConfig,
      },
      async init({ logger, database, httpRouter, discovery, auth, config }) {
        logger.info('Initializing DORA Metrics plugin');

        // Get Knex database instance
        const db = await database.getClient();

        // Create router for API endpoints
        const router = await createRouter({
          database: db,
          logger: logger as any,
        });

        httpRouter.use(router);

        // Start GitHub data collector (scheduler)
        const catalogClient = new CatalogClient({ discoveryApi: discovery });
        const store = new DoraMetricsStore(db);
        const collector = new GitHubCollector({
          logger: logger as any,
          catalogClient,
          auth,
          store,
          config,
        });

        collector.start();

        logger.info('DORA Metrics plugin initialized successfully');
      },
    });
  },
});
