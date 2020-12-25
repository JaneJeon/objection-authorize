const path = require('path')
const knex = require('knex')
require('dotenv').config({ path: '.db.env' })

module.exports = knex({
  client: 'pg',
  connection: {
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER
  },
  useNullAsDefault: true,
  asyncStackTraces: true,
  migrations: {
    directory: path.join(__dirname, '../migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../seeds')
  }
})
