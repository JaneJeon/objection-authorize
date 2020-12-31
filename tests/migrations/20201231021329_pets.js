const Pet = require('../models/pet')

exports.up = function (knex) {
  return knex.schema.createTable(Pet.tableName, table => {
    table.integer('id').primary()
    table.integer('owner_id').references('users.id').onDelete('CASCADE')
    table.text('name')
  })
}

exports.down = function (knex) {}
