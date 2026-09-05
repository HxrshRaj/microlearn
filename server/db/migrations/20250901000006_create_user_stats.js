/** @param {import('knex').Knex} knex */
exports.up = function up(knex) {
  return knex.schema.createTable('user_stats', (table) => {
    // One denormalized row per user, updated transactionally alongside each
    // progress insert. Mirrors the old single-user `stats` object from
    // data.json, just scoped per user now.
    table
      .bigInteger('user_id')
      .primary()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.integer('total_xp').notNullable().defaultTo(0);
    table.integer('current_streak').notNullable().defaultTo(0);
    table.integer('longest_streak').notNullable().defaultTo(0);
    table.date('last_activity_date');
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/** @param {import('knex').Knex} knex */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('user_stats');
};
