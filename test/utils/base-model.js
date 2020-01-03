module.exports = version => {
  const { Model } = require(`objection-${version}`)
  const visibility = require('objection-visibility').default

  Model.knex(require('./knex'))

  return class BaseModel extends visibility(Model) {}
}
