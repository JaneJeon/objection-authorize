const httpError = require('http-errors')

class ACLInterface {
  constructor(acl, args, defaultAction) {
    if (!acl) throw new Error('ACLInterface: missing input `acl`')
    if (!args) throw new Error('ACLInterface: missing input `args`')
    if (!defaultAction)
      throw new Error('ACLInterface: missing input `defaultAction`')

    const { items, inputItems, relation, context: queryContext } = args
    const {
      _user: user,
      _opts: opts,
      _action,
      _resource: resource,
      _authorize: authorize
    } = queryContext

    if (!authorize) return

    Object.assign(this, {
      acl,
      items: resource
        ? Array.isArray(resource)
          ? resource
          : [resource]
        : items.length
        ? items
        : [{}],
      inputItems: inputItems.length ? inputItems : [{}],
      user,
      action: _action || defaultAction,
      opts,
      relation,
      authorize
    })
  }

  // Yes, I'm still enforcing synchronous ACL checks!!
  checkAccess() {
    if (!this.authorize) return
    this.items.forEach(item => {
      this.inputItems.forEach(inputItem => {
        if (!this._checkIndividualAccess(item, inputItem))
          throw httpError(
            this.user.role === this.opts.defaultRole
              ? this.opts.unauthenticatedErrorCode
              : this.opts.unauthorizedErrorCode
          )
      })
    })
  }

  /**
   * This function should be overridden to check a particular item/inputItem pair,
   * and return true/false depending on whether the check succeeded or not.
   * @param {Object} item
   * @param {Object} inputItem
   * @returns {Boolean}
   */
  _checkIndividualAccess(item, inputItem) {
    throw new Error('Override this method before use!')
  }

  /**
   * This function should be overridden to return "allowed" fields for a read action,
   * where we're only checking the model instance (this.items[0]) with the ACL.
   * NOTE: the returning fields should be in dot notation (e.g. 'field.subfield')
   * @returns {Array}
   */
  get allowedFields() {
    throw new Error('Override this method before use!')
  }
}

module.exports = ACLInterface
