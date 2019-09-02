const assert = require('http-assert')

module.exports = (acl, opts) => {
  if (!acl) throw new Error('acl is a required parameter!')
  if (typeof acl.can !== 'function')
    throw new Error(
      'did you pass the grants object directly instead of the access control instnace?'
    )

  const defaultOpts = {
    defaultRole: 'anonymous',
    unauthenticatedErrorCode: 401,
    unauthorizedErrorCode: 403,
    resourceName: model => model.name,
    resourceAugments: { true: true, false: false },
    userFromResult: false
  }
  opts = Object.assign(defaultOpts, opts)

  return Model => {
    return class extends Model {
      // used to filter model's attributes according to a user's read access.
      // First pick the fields, and then filter them, as per:
      // https://github.com/oscaroox/objection-visibility
      _filter(attributes = []) {
        const pickFields = attributes.filter(
          field => field !== '*' && !field.startsWith('!')
        )
        const omitFields = attributes
          .filter(field => field.startsWith('!'))
          .map(field => field.substr(1))

        if (pickFields.length) this.$pick(pickFields)
        if (omitFields.length) this.$omit(omitFields)

        return this // for chaining
      }

      // inject instance context
      $query(trx) {
        return super.$query(trx).mergeContext({ instance: this })
      }

      $relatedQuery(relation, trx) {
        return super
          .$relatedQuery(relation, trx)
          .mergeContext({ instance: this })
      }

      static get QueryBuilder() {
        return class extends Model.QueryBuilder {
          // wrappers around acl, querybuilder, and model
          _checkAccess(action, body) {
            const { user, resource, opts } = this.context()
            body = body || resource

            // _checkAccess may be called outside of authorization context
            if (!(user && resource)) return

            const access = acl
              .can(user.role)
              .execute(action)
              .context(
                Object.assign(
                  {},
                  resource,
                  { req: { user, body } },
                  opts.resourceAugments
                )
              )
              .on(opts.resourceName(this.modelClass()))

            // authorize request
            assert(
              access.granted,
              user.role == opts.defaultRole
                ? opts.unauthenticatedErrorCode
                : opts.unauthorizedErrorCode
            )

            return access
          }

          // THE magic method that schedules the actual authorization logic to be called
          // later down the line when the "action method" (insert/patch/delete) is called
          authorize(user, resource, optOverride) {
            user = Object.assign({ role: opts.defaultRole }, user)
            resource = resource || this.context().instance || {}
            const requestOpts = Object.assign({}, opts, optOverride)

            return this.mergeContext({ user, resource, opts: requestOpts })
              .runBefore((result, query) => {
                // this is run AFTER the query has been completely built.
                // In other words, the query already checked create/update/delete access
                // by this point, and the only thing to check now is the read access
                if (query.isFind()) {
                  const readAccess = query._checkAccess('read')

                  // store the read access just in case
                  query.mergeContext({ readAccess })
                }

                return result
              })
              .runAfter((result, query) => {
                const isArray = Array.isArray(result)
                // here, we're assuming that if the result is an object, then it must be
                // an instance of Model, because otherwise toJSON() won't be defined!!
                const isModel = typeof result === 'object'

                // there's no result object(s) to filter here
                if (!(isArray || isModel)) return result

                // after create/update operations, the returning result may be the requester
                if (isModel) {
                  const { user, opts } = this.context()

                  // check if we the user is changed
                  if (opts.userFromResult) {
                    const resultIsUser =
                      opts.userFromResult === 'function'
                        ? opts.userFromResult(user, result)
                        : true

                    // now we need to re-check read access from the context of the changed user
                    if (resultIsUser) {
                      // first, override the user and resource context for _checkAccess.
                      // Note that it's important to specify the result here because we're
                      // checking read access against the user itself
                      query.mergeContext({ user: result, resource: result })
                      // then obtain read access
                      const readAccess = query._checkAccess('read')
                      // then merge readAccess for the next line
                      query.mergeContext({ readAccess })
                    }
                  }
                }

                const readAccess =
                  query.context().readAccess || query._checkAccess('read')

                return isArray
                  ? // if we're fetching multiple resources, the result will be an array.
                    // While access.filter() accepts arrays, we need to invoke any $formatJson()
                    // hooks by individually calling toJSON() on individual models since:
                    // 1. arrays don't have toJSON() method,
                    // 2. objection-visibility doesn't work without calling $formatJson()
                    result.map(model => model._filter(readAccess.attributes))
                  : result._filter(readAccess.attributes)
              })
          }

          // automatically checks if you can create this resource, and if yes,
          // restricts the body object to only the fields they're allowed to set
          insert(body) {
            const access = this._checkAccess('create', body)

            // when authorize() isn't called, access will be empty
            return super.insert(access ? access.filter(body) : body)
          }

          // automatically checks if you can update this resource, and if yes,
          // restricts the body object to only the fields they're allowed to set
          patch(body) {
            const access = this._checkAccess('update', body)

            return super.patch(access ? access.filter(body) : body)
          }

          // automatically checks if you can delete this resource
          delete() {
            this._checkAccess('delete')

            return super.delete()
          }
        }
      }
    }
  }
}
