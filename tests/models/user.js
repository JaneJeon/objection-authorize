const BaseModel = require('./base')

class User extends BaseModel {
  get modelProperty() {
    return 'something'
  }

  static get relationMappings() {
    return {
      pets: {
        relation: BaseModel.HasManyRelation,
        modelClass: 'pet',
        join: {
          from: 'users.id',
          to: 'pets.ownerId'
        }
      }
    }
  }
}

module.exports = User
