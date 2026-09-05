/** @param {import('knex').Knex} knex */
exports.up = function up(knex) {
  return knex.schema.createTable('sessions', (table) => {
    // Primary key is the SHA-256 hash of the opaque token stored in the
    // client's cookie — the raw token is never persisted (see server/lib/session.js).
    table.text('id').primary();
    table
      .bigInteger('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.text('user_agent');
    table.index('user_id');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('sessions');
};
