const knex = require('./knex')

module.exports = async () => {
  await knex.migrate.latest()
  await knex.seed.run()
}
