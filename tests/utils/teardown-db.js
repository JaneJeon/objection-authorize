const knex = require('./knex')

if (typeof afterAll !== 'undefined')
  afterAll(async () => {
    await knex.destroy()
  })

module.exports = async () => {
  await knex.destroy()
}
