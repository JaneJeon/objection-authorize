const assert = require('http-assert')

module.exports = (acl, opts) => {
  if (!acl) throw new Error('acl is a required parameter!')
  if (typeof acl.can !== 'function') {
    throw new Error(
      'did you pass the grants object directly instead of the access control instnace?'
    )
  }

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
      _filter (attributes = []) {
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
      $query (trx) {
        return super.$query(trx).mergeContext({ instance: this })
      }

      $relatedQuery (relation, trx) {
        return super
          .$relatedQuery(relation, trx)
          .mergeContext({ instance: this })
      }

      static get QueryBuilder () {
        return class extends Model.QueryBuilder {
          // wrappers around acl, querybuilder, and model
          _checkAccess (action, body) {
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
              user.role === opts.defaultRole
                ? opts.unauthenticatedErrorCode
                : opts.unauthorizedErrorCode
            )

            return access
          }

          // THE magic method that schedules the actual authorization logic to be called
          // later down the line when the "action method" (insert/patch/delete) is called
          authorize (user, resource, optOverride) {
            user = Object.assign({ role: opts.defaultRole }, user)
            resource = resource || this.context().instance || {}
            const queryOpts = Object.assign({}, opts, optOverride)

            return this.mergeContext({ user, resource, opts: queryOpts })
              .runBefore((result, query) => {
                // this is run AFTER the query has been completely built.
                // In other words, the query already checked create/update/delete access
                // by this point, and the only thing to check now is the read access,
                // IF the resource is specified. Otherwise, it's delayed till the end!
                if (query.isFind() && Object.keys(resource).length) {
                  const readAccess = query._checkAccess('read')

                  // store the read access just in case
                  query.mergeContext({ readAccess })
                }

                return result
              })
              .runAfter((result, query) => {
                // there's no result object(s) to filter here
                if (typeof result !== 'object') return result

                const isArray = Array.isArray(result)

                let {
                  resource,
                  first,
                  opts,
                  user,
                  readAccess
                } = query.context()

                // set the resource as the result if it's still not set!
                // Note, since the resource needs to be singular, it can only be done
                // when there's only one result!
                if (!Object.keys(resource).length) {
                  if (!isArray) query.mergeContext({ resource: result })
                  else if (first) query.mergeContext({ resource: result[0] })
                }

                // after create/update operations, the returning result may be the requester
                if (
                  (query.isInsert() || query.isUpdate()) &&
                  !isArray &&
                  opts.userFromResult
                ) {
                  // check if we the user is changed
                  const resultIsUser =
                    typeof opts.userFromResult === 'function'
                      ? opts.userFromResult(user, result)
                      : true

                  // now we need to re-check read access from the context of the changed user
                  if (resultIsUser) {
                    // first, override the user and resource context for _checkAccess
                    query.mergeContext({ user: result })
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
                  ? result.map(model => model._filter(readAccess.attributes))
                  : result._filter(readAccess.attributes)
              })
          }

          first () {
            this.mergeContext({ first: true })

            return super.first()
          }

          // insert/patch/update/delete are the "primitive" query actions.
          // All other methods like insertAndFetch or deleteById are built on these.

          // automatically checks if you can create this resource, and if yes,
          // restricts the body object to only the fields they're allowed to set
          insert (body) {
            const access = this._checkAccess('create', body)

            // when authorize() isn't called, access will be empty
            return super.insert(access ? access.filter(body) : body)
          }

          patch (body) {
            const access = this._checkAccess('update', body)

            return super.patch(access ? access.filter(body) : body)
          }

          /* istanbul ignore next */
          update (body) {
            const access = this._checkAccess('update', body)

            return super.update(access ? access.filter(body) : body)
          }

          delete (body) {
            this._checkAccess('delete', body)

            return super.delete()
          }
        }
      }
    }
  }
}
