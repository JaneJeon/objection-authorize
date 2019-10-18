const assert = require('http-assert')
const isEmpty = obj => !Object.keys(obj || {}).length

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
        return super.$query(trx).mergeContext({ _instance: this })
      }

      $relatedQuery (relation, trx) {
        return super
          .$relatedQuery(relation, trx)
          .mergeContext({ _instance: this })
      }

      static get QueryBuilder () {
        return class extends Model.QueryBuilder {
          get _shouldCheckAccess () {
            return this.context()._authorize
          }

          // wrappers around acl, querybuilder, and model
          async _checkAccess (action) {
            let {
              _user: user,
              _resource: resource,
              _opts: opts,
              _body: body
            } = this.context()
            body = body || resource

            // _checkAccess may be called outside of authorization context
            if (!this._shouldCheckAccess) return

            const access = await acl
              .can(user.role)
              .execute(action)
              .context(
                Object.assign(
                  {},
                  { req: { user, body } },
                  opts.resourceAugments,
                  resource
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

          // insert/patch/update/delete are the "primitive" query actions.
          // All other methods like insertAndFetch or deleteById are built on these.

          // Because role-acl fucked up everything by making its APIs async,
          // we CANNOT get the access context within these query methods,
          // since they are synchronous.
          // Therefore, the best we can do is to is to just augment the context,
          // schedule the query to be run, and do the actual check in the runBefore() hook.
          // However, this means that we CANNOT modify the body on-the-fly according
          // to the access context, so you either pass the body directly, or you get 403 error.
          insert (_body) {
            this.mergeContext({ _body })

            return super.insert(_body)
          }

          patch (_body) {
            this.mergeContext({ _body })

            return super.patch(_body)
          }

          /* istanbul ignore next */
          update (_body) {
            this.mergeContext({ _body })

            return super.update(_body)
          }

          delete (_body) {
            this.mergeContext({ _body })

            return super.delete()
          }

          deleteById (id, body) {
            return this.findById(id).delete(body)
          }

          // THE magic method that schedules the actual authorization logic to be called
          // later down the line when the query is built and is ready to be executed.
          authorize (user, resource, optOverride) {
            return (
              this.mergeContext({
                _user: Object.assign({ role: opts.defaultRole }, user),
                _resource: resource || this.context()._instance || {},
                _opts: Object.assign({}, opts, optOverride),
                _authorize: true
              })
                // this is run AFTER the query has been completely built
                .runBefore(async (result, query) => {
                  if (!query._shouldCheckAccess) return result

                  if (query.isInsert()) await query._checkAccess('create')
                  else if (query.isUpdate()) await query._checkAccess('update')
                  else if (query.isDelete()) await query._checkAccess('delete')
                  else if (
                    query.isFind() &&
                    // check read access if we know what the access is before the query is run,
                    // and then pass the readAccess to the context so we don't have to check again
                    !isEmpty(query.context()._resource)
                  )
                    query.mergeContext({
                      _readAccess: await query._checkAccess('read')
                    })

                  return result
                })
                .runAfter(async (result, query) => {
                  // there's no result object(s) to filter here
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

                  // set the resource as the result if it's still not set!
                  // Note, since the resource needs to be singular, it can only be done
                  // when there's only one result!
                  if (isEmpty(resource)) {
                    if (!isArray) query.mergeContext({ _resource: result })
                    else if (first) query.mergeContext({ _resource: result[0] })
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
                      query.mergeContext({ _user: result })
                      // then obtain read access
                      readAccess = query._checkAccess('read')
                    }
                  }

                  readAccess = readAccess || (await query._checkAccess('read'))

                  // if we're fetching multiple resources, the result will be an array.
                  // While access.filter() accepts arrays, we need to invoke any $formatJson()
                  // hooks by individually calling toJSON() on individual models since:
                  // 1. arrays don't have toJSON() method,
                  // 2. objection-visibility doesn't work without calling $formatJson()
                  return isArray
                    ? result.map(model => model._filter(readAccess.attributes))
                    : result._filter(readAccess.attributes)
                })
            )
          }

          first () {
            this.mergeContext({ _first: true })

            return super.first()
          }
        }
      }
    }
  }
}
