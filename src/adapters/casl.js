const ACLInterface = require('./base')
const objectDeepKeys = require('../utils/object-deep-keys')
const { permittedFieldsOf } = require('@casl/ability/extra')

class CASL extends ACLInterface {
  _checkIndividualAccess(item, inputItem) {
    // Check whether the user can perform a particular action
    // NOTE: body is only used for BUILDING the rules, not CHECKING it!
    const ability = this.acl(
      this.user,
      item,
      this.action,
      inputItem,
      this.opts,
      this.relation
    )

    // Now that we don't need to "filter out" wrong inputs,
    // we can simply check all of the attributes it's trying to change.
    // Note that we're passing ALL the fields, including the embedded ones,
    // as dot notation for the ability checker;
    // normally this would be overkill but this covers cases where you're somehow
    // checking ACL on deep, nested fields.
    const fields = objectDeepKeys(inputItem)
    if (fields.length) {
      for (let i = 0; i < fields.length; i++)
        if (ability.cannot(this.action, item, fields[i])) return false
      return true
    } else return ability.can(this.action, item)
  }

  get allowedFields() {
    const modelInstance = this.items[0]
    const fields = objectDeepKeys(modelInstance)
    const ability = this.acl(
      this.user,
      modelInstance,
      this.action,
      this.inputItems[0],
      this.opts
    )

    // casl on its own does not have any idea what all of the fields available are.
    // Therefore, we must inject them directly by reading them from the actual model instance
    return permittedFieldsOf(ability, this.action, modelInstance, {
      fieldsFrom: rule => rule.fields || fields
    })
  }
}

module.exports = CASL
