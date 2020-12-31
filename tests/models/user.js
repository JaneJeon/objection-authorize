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
          from: 'persons.id',
          to: 'pets.ownerId'
        }
      }
    }
  }
}

module.exports = User
