const User = require('../models/user')

exports.up = function (knex) {
  knex.schema.createTable(User.tableName, table => {
    table.increments()
    table.text('username')
    table.text('password')
    table.text('role')
    table.json('metadata') // meta: { fixedField: 'foo', mutableField: 'bar' }
  })
}

exports.down = function (knex) {}
