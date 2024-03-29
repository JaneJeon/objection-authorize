const User = require('../models/user')

exports.up = function (knex) {
  return knex.schema.createTable(User.tableName, table => {
    table.integer('id').primary()
    table.text('username')
    table.text('password')
    table.text('role')
    table.jsonb('metadata')

    table.timestamps()
  })
}

exports.down = function (knex) {}
