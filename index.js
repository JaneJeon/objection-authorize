module.exports = (acl, library = 'role-acl', opts) => {
  if (!acl || typeof library === 'object') {
    throw new Error(
      "usage: require('objection-authorize')(acl, library: String[, opts: Object])(Model)"
    )
  }

  const defaultOpts = {
    defaultRole: 'anonymous',
    unauthenticatedErrorCode: 401,
    unauthorizedErrorCode: 403
  }
  opts = Object.assign(defaultOpts, opts)

  const Adapter = require(`./adapters/${library}`)

  return Model => {
    class AuthQueryBuilder extends Model.QueryBuilder {
      // Learn more about static hooks here:
      // https://vincit.github.io/objection.js/guide/hooks.html#instance-query-hooks
      static async beforeInsert(args) {
        await super.beforeInsert(args)
        new Adapter(acl, args, 'create').checkAccess()
      }

      static async beforeUpdate(args) {
        await super.beforeUpdate(args)

        // TODO: PUT support with asFindQuery
        // is there a way to do this optionally?
        new Adapter(acl, args, 'update').checkAccess()
      }

      static async beforeDelete(args) {
        await super.beforeDelete(args)
        new Adapter(acl, args, 'delete').checkAccess()
      }

      static async beforeFind(args) {
        await super.beforeFind(args)
        new Adapter(acl, args, 'read').checkAccess()
      }

      // specify a custom action, which takes precedence over the "default" action.
      action(_action) {
        this.context({ _action })
        return this
      }

      // result is always an array, so we figure out if we should look at the result
      // as a single object instead by looking at whether .first() was called or not.
      first() {
        this.context({ _first: true })
        return super.first()
      }

      // THE magic method that schedules the actual authorization logic to be called
      // later down the line when the query is built and is ready to be executed.
      authorize(user, resource, optOverride) {
        return this.context({
          _user: Object.assign({ role: opts.defaultRole }, user),
          _opts: Object.assign({}, opts, optOverride),
          _resource: resource || this.context()._instance || {},
          _authorize: true
        })
      }
    }

    return class extends Model {
      static get QueryBuilder() {
        return AuthQueryBuilder
      }
    }
  }
}
