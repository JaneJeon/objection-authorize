const { Model } = require('objection')
const tableName = require('objection-table-name')()

Model.knex(require('../utils/knex'))

class BaseModel extends tableName(Model) {
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
