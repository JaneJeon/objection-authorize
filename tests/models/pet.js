const BaseModel = require('./base')

class Pet extends BaseModel {
  get modelProperty() {
    return 'something2'
  }

  static get relationMappings() {
    return {
      owner: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: 'user',
        join: {
          from: 'pets.ownerId',
          to: 'users.id'
        }
      }
    }
  }
}

module.exports = Pet
