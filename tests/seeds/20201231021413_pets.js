const Pet = require('../models/pet')

exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex(Pet.tableName)
    .del()
    .then(function () {
      // Inserts seed entries
      return knex(Pet.tableName).insert([
        {
          id: 3,
          name: 'doggo'
        }
      ])
    })
}
