const BaseModel = require('./base')

class User extends BaseModel {
  static get hidden() {
    return ['id']
  }
}

module.exports = User
