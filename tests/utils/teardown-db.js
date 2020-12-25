const knex = require('./knex')

module.exports = async () => {
  await knex.destroy()
}
