/** @param {import('knex').Knex} knex */
exports.up = function up(knex) {
  return knex.schema.createTable('questions', (table) => {
    table.increments('id').primary();
    table
      .integer('lesson_id')
      .notNullable()
      .references('id')
      .inTable('lessons')
      .onDelete('CASCADE');
    table.text('prompt').notNullable();
    table.jsonb('options').notNullable(); // array of option strings
    table.integer('correct_index').notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.index('lesson_id');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('questions');
};
