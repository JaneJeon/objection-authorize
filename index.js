const isEmpty = obj => !Object.keys(obj || {}).length

module.exports = (acl, library = 'role-acl', opts) => {
  if (!acl || typeof library === 'object') {
    throw new Error(
      "usage: require('objection-authorize')(acl, library: String[, opts: Object])(Model)"
    )
  }

  const defaultOpts = {
    defaultRole: 'anonymous',
    unauthenticatedErrorCode: 401,
    unauthorizedErrorCode: 403,
    userFromResult: false
  }
  opts = Object.assign(defaultOpts, opts)

  const Adapter = require(`./adapters/${library}`)

  return Model => {
    class AuthQueryBuilder extends Model.QueryBuilder {
      static async beforeInsert(args) {
        await super.beforeInsert(args)
        new Adapter(acl, args, 'create').checkAccess()
      }

      static async afterInsert(args) {
        await super.afterInsert(args)
        // A singular "input"

        // TODO: filter fields, optionally?
      }

      static async beforeUpdate(args) {
        await super.beforeUpdate(args)
        new Adapter(acl, args, 'update').checkAccess()
      }

      static async afterUpdate(args) {
        await super.afterUpdate(args)
      }

      static async beforeDelete(args) {
        await super.beforeDelete(args)
        new Adapter(acl, args, 'delete').checkAccess()
      }

      static async afterDelete(args) {
        await super.afterDelete(args)
      }

      static async beforeFind(args) {
        await super.beforeFind(args)
        new Adapter(acl, args, 'read').checkAccess()
      }

      static async afterFind(args) {
        await super.afterFind(args)
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
        resource = resource || this.context()._instance || {}
        this._resource = resource
        this.context({
          _user: Object.assign({ role: opts.defaultRole }, user),
          _opts: Object.assign({}, opts, optOverride),
          _authorize: true
        }).runAfter(async (result, query) => {
          // If there's no result objects, we don't need to filter them.
          if (typeof result !== 'object' || !query._shouldCheckAccess)
            return result

          const isArray = Array.isArray(result)

          let {
            _resource: resource,
            _first: first,
            _opts: opts,
            _user: user,
            _readAccess: readAccess
          } = query.context()

          // Set the resource as the result if it's still not set!
          // Note, since the resource needs to be singular, it can only be done
          // when there's only one result -
          // we're trusting that if the query returns an array of results,
          // then you've already filtered it according to the user's read access
          // in the query (instead of relying on the ACL to do it) since it's costly
          // to check every single item in the result array...
          if (isEmpty(resource) && (!isArray || first)) {
            resource = isArray ? result[0] : result
            resource = query.modelClass().fromJson(resource, {
              skipValidation: true
            })
            query.context({ _resource: resource })
          }

          // after create/update operations, the returning result may be the requester
          if (
            (query.isInsert() || query.isUpdate()) &&
            !isArray &&
            opts.userFromResult
          ) {
            // check if the user is changed
            const resultIsUser =
              typeof opts.userFromResult === 'function'
                ? opts.userFromResult(user, result)
                : true

            // now we need to re-check read access from the context of the changed user
            if (resultIsUser) {
              // first, override the user and resource context for _checkAccess
              query.context({ _user: result })
              // then obtain read access
              readAccess = query._checkAccess('read')
            }
          }

          readAccess = readAccess || query._checkAccess('read')

          // if we're fetching multiple resources, the result will be an array.
          // While access.filter() accepts arrays, we need to invoke any $formatJson()
          // hooks by individually calling toJSON() on individual models since:
          // 1. arrays don't have toJSON() method,
          // 2. objection-visibility doesn't work without calling $formatJson()
          return isArray
            ? result.map(model => model._filterModel(readAccess))
            : result._filterModel(readAccess)
        })

        // for chaining
        return this
      }
    }

    return class extends Model {
      static get QueryBuilder() {
        return AuthQueryBuilder
      }
    }
  }
}
