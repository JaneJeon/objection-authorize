const ACLInterface = require('./base')
const objectDeepKeys = require('../utils/object-deep-keys')
const { permittedFieldsOf } = require('@casl/ability/extra')

class CASL extends ACLInterface {
  _checkIndividualAccess(item, inputItem) {
    // Check whether the user can perform a particular action
    // NOTE: body is only used for BUILDING the rules, not CHECKING it!
    const ability = this.acl(this.user, item, this.action, inputItem, this.opts)

    // Now that we don't need to "filter out" wrong inputs,
    // we can simply check all of the attributes it's trying to change.
    // Note that we're passing ALL the fields, including the embedded ones,
    // as dot notation for the ability checker;
    // normally this would be overkill but this covers cases where you're somehow
    // checking ACL on deep, nested fields.
    const fields = objectDeepKeys(inputItem)
    return fields.length
      ? ability.can(this.action, item, fields)
      : ability.can(this.action, item)
  }

  get allowedFields() {
    const ability = this.acl(
      this.user,
      this.items[0],
      this.action,
      this.inputItems[0],
      this.opts
    )

    return permittedFieldsOf(ability, this.action, this.items[0])
  }
}

module.exports = CASL
