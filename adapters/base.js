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

    if (authorize) this.authorize = authorize
    else
      Object.assign(this, {
        acl,
        items: resource
          ? Array.isArray(resource)
            ? resource
            : [resource]
          : items,
        inputItems,
        user,
        action: _action || defaultAction,
        opts,
        relation
      })
  }

  // Yes, I'm still enforcing synchronous ACL checks!!
  checkAccess() {
    if (!this.authorize) return
    this._checkAccess()
  }

  _checkAccess() {
    throw new Error('Do not call the ACL Interface directly!')
  }

  _stop() {
    throw httpError(
      this.user.role === this.opts.defaultRole
        ? this.opts.unauthenticatedErrorCode
        : this.opts.unauthorizedErrorCode
    )
  }
}

module.exports = ACLInterface
