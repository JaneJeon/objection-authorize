const User = require('../models/user')

exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex(User.tableName)
    .del()
    .then(function () {
      // Inserts seed entries
      return knex(User.tableName).insert([
        {
          id: 1,
          username: 'user1',
          password: 'plaintext',
          role: 'user',
          metadata: {
            fixedField: 'foo',
            mutableField: 'bar',
            hiddenField: 'super secret'
          }
        },
        {
          id: 2,
          username: 'user2',
          password: 'plaintext',
          role: 'user',
          metadata: {
            fixedField: 'baz',
            mutableField: '???',
            hiddenField: 'super secret 2: electric boogaloo'
          }
        }
      ])
    })
}
