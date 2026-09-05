/** @param {import('knex').Knex} knex */
exports.up = function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.bigIncrements('id').primary();
    table.text('username').notNullable().unique();
    table.text('email').notNullable().unique();
    table.text('password_hash').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/** @param {import('knex').Knex} knex */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('users');
};
