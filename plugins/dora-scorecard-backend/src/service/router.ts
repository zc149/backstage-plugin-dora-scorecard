import express from 'express';
import { Logger } from 'winston';
import { Knex } from 'knex';
import { DoraMetricsService } from './DoraMetricsService';
import { DoraMetricsStore } from '../database/DoraMetricsStore';
import { resolve } from 'path';

export async function createRouter(options: {
  database: Knex;
  logger: Logger;
}): Promise<express.Router> {
  const { database, logger } = options;
  const router = express.Router();

  router.use(express.json());

  // Run migrations
  logger.info('[DORA] Checking database migrations...');
  try {
    const migrationDir = resolve(__dirname, '../../migrations');
    await database.migrate.latest({
      directory: migrationDir,
      tableName: 'knex_migrations_dora'
    });
    logger.info('[DORA] Database migrations are up to date.');
  } catch (error) {
    logger.error(`[DORA] Failed to run migrations: ${error}`);
  }

  const store = new DoraMetricsStore(database);
  const service = new DoraMetricsService(store);

  // GET /scorecard/:service
  router.get('/scorecard/:service', async (req, res) => {
    try {
      const { service: serviceName } = req.params;
      const days = Number(req.query.days || '30');

      const scorecard = await service.getScorecard(serviceName, days);
      res.json(scorecard);
    } catch (error: any) {
      logger.error(`[DORA-API] Scorecard Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /targets/:service
  router.post('/targets/:service', async (req, res) => {
    try {
      const { service: serviceName } = req.params;
      const { deploymentFrequency, leadTime, changeFailureRate, mttr } = req.body;

      await service.updateTargets(serviceName, {
        deploymentFrequency,
        leadTime,
        changeFailureRate,
        mttr,
      });

      res.json({ status: 'ok' });
    } catch (error: any) {
      logger.error(`[DORA-API] Update Targets Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
