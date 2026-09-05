/** @param {import('knex').Knex} knex */
exports.up = function up(knex) {
  return knex.schema.createTable('lessons', (table) => {
    table.increments('id').primary();
    table.text('title').notNullable();
    table.text('category').notNullable();
    table.text('summary').notNullable();
    table.integer('xp_reward').notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index('category');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('lessons');
};
