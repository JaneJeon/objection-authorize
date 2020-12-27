const httpError = require('http-errors')
const objectDiff = require('../utils/object-diff')

class ACLInterface {
  constructor(acl, args, defaultAction) {
    if (!acl) throw new Error('ACLInterface: missing input `acl`')
    if (!args) throw new Error('ACLInterface: missing input `args`')
    if (!defaultAction)
      throw new Error('ACLInterface: missing input `defaultAction`')

    let { items, inputItems, relation, context: queryContext } = args
    const {
      _user: user,
      _opts: opts,
      _action,
      _resource: resource,
      _authorize: authorize,
      _class: ModelClass,
      _diffInputFromResource: diffInputFromResource
    } = queryContext

    if (!authorize) return

    if (resource) {
      const resourceList = Array.isArray(resource) ? resource : [resource]
      // just to make sure, wrap every resource in class
      items = resourceList.map(resource =>
        resource instanceof ModelClass
          ? resource
          : ModelClass.fromJson(resource, { skipValidation: true })
      )
    } else if (!items.length) items = [new ModelClass()]

    Object.assign(this, {
      acl,
      items,
      inputItems: inputItems.length ? inputItems : [new ModelClass()],
      user,
      action: _action || defaultAction,
      opts,
      relation,
      authorize,
      ModelClass,
      diffInputFromResource
    })
  }

  // Yes, I'm still enforcing synchronous ACL checks!!
  checkAccess() {
    if (!this.authorize) return
    this.items.forEach(item => {
      this.inputItems.forEach(inputItem => {
        if (this.diffInputFromResource) inputItem = objectDiff(item, inputItem)

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
