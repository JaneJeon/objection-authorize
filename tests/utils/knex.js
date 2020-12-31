const knex = require('knex')
require('dotenv').config({ path: '.db.env' })

module.exports = knex(require('../../knexfile'))
