const { Model } = require('objection')
const visibility = require('objection-visibility').default

Model.knex(require('./knex'))

class BaseModel extends visibility(Model) {}

module.exports = BaseModel
