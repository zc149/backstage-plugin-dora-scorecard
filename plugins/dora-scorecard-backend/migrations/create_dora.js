/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function(knex) {
  const hasDailyMetrics = await knex.schema.hasTable('dora_daily_metrics');

  if (!hasDailyMetrics) {
    await knex.schema.createTable('dora_daily_metrics', table => {
      table.increments('id').primary();

      // Target service (e.g., component:default/order-service)
      table.string('entity_ref').notNullable();

      // Date (YYYY-MM-DD)
      table.date('date').notNullable();

      // Deployment Frequency
      table.integer('deployment_count').defaultTo(0);

      // Change Failure Rate
      table.integer('deployment_failure_count').defaultTo(0);

      // Lead Time for Changes
      table.integer('lead_time_avg_seconds').defaultTo(0);

      // Mean Time to Recovery (MTTR)
      table.integer('mttr_avg_seconds').defaultTo(0);

      // Indexes for performance optimization
      table.unique(['entity_ref', 'date']);
      table.index('date');
      table.index('entity_ref');

      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  const hasTargets = await knex.schema.hasTable('dora_targets');

  if (!hasTargets) {
    await knex.schema.createTable('dora_targets', table => {
      // Service identifier (PK) - one target per service
      table.string('entity_ref').primary();

      // Target deployment frequency (per week)
      table.float('target_freq').defaultTo(1.0);

      // Target lead time (hours)
      table.float('target_lead').defaultTo(24.0);

      // Target failure rate (%)
      table.float('target_fail').defaultTo(5.0);

      // Target MTTR (minutes)
      table.float('target_mttr').defaultTo(60.0);

      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('dora_targets');
  await knex.schema.dropTableIfExists('dora_daily_metrics');
};