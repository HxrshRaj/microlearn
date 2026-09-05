/** @param {import('knex').Knex} knex */
exports.up = function up(knex) {
  return knex.schema.createTable('progress', (table) => {
    // Append-only attempt log: one row per quiz submission. This is what
    // powers the per-lesson history view (score over time), not just
    // whatever the most recent attempt happened to be.
    table.bigIncrements('id').primary();
    table
      .bigInteger('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('lesson_id')
      .notNullable()
      .references('id')
      .inTable('lessons')
      .onDelete('CASCADE');
    table.integer('score').notNullable(); // 0-100
    table.integer('xp_earned').notNullable();
    table.timestamp('completed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['user_id', 'lesson_id']);
    table.index(['user_id', 'completed_at']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('progress');
};
