const ACLInterface = require('./base')
// Fuck it. v3 -> v4 transition didn't involve any changes to `permittedFieldsOf`:
// https://github.com/stalniy/casl/blob/master/packages/casl-ability/CHANGELOG.md
const { permittedFieldsOf } = require('@casl/ability/extra')

class CASL extends ACLInterface {
  _checkAccess() {
    this.items.forEach(item => {
      const ability = this.acl(
        this.user,
        item,
        this.action,
        this.inputItem,
        this.opts
      )
      if (!ability.can(this.action, item)) this._stop()

      // if the number of "filtered" fields is less than the number of fields you started with,
      // then your request is invalid.
      // Since we don't care about coercing/stripping off invalid fields,
      // we can just throw an error here *without* having to check what fields ARE available!
      const fields = permittedFieldsOf(ability, this.action, item)
      if (fields.length < Object.keys(item).length) this._stop()
    })
  }
}

module.exports = CASL
