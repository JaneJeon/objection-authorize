const { Model } = require('objection')
const visibility = require('objection-visibility').default
const tableName = require('objection-table-name')()

Model.knex(require('knex')(require('../knexfile')))

class BaseModel extends tableName(visibility(Model)) {
  static get modelPaths() {
    return [__dirname]
  }

  static get useLimitInFirst() {
    return true
  }

  static get defaultEagerAlgorithm() {
    return Model.JoinEagerAlgorithm
  }
}

module.exports = BaseModel
