const assert = require('http-assert')
const isEmpty = obj => !Object.keys(obj || {}).length
const debug = require('debug')('objection-authorize')

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
    resourceAugments: { true: true, false: false, undefined: undefined },
    userFromResult: false,
    contextKey: 'req',
    library: 'role-acl'
  }
  opts = Object.assign(defaultOpts, opts)

  const lib = require(`./lib/${opts.library}`)

  return Model => {
    class AuthQueryBuilder extends Model.QueryBuilder {
      get _shouldCheckAccess () {
        return this.context()._authorize
      }

      // wrappers around acl, querybuilder, and model
      _checkAccess (action, body) {
        // _checkAccess may be called outside of authorization context
        if (!this._shouldCheckAccess) return

        debug('_checkAccess', action, body)
        let {
          _user: user,
          _resource: resource,
          _opts: opts,
          _action
        } = this.context()
        body = body || resource
        action = _action || action
        const ctx = Object.assign(
          {},
          { [opts.contextKey]: { user, body } },
          opts.resourceAugments,
          resource
        )
        resource = this.modelClass().fromJson(resource, {
          skipValidation: true
        })

        const access = lib.getAccess(acl, user, resource, action, ctx)

        // authorize request
        assert(
          lib.isAuthorized(access),
          user.role === opts.defaultRole
            ? opts.unauthenticatedErrorCode
            : opts.unauthorizedErrorCode
        )

        return access
      }

      // insert/patch/update/delete are the "primitive" query actions.
      // All other methods like insertAndFetch or deleteById are built on these.

      // automatically checks if you can create this resource, and if yes,
      // restricts the body object to only the fields they're allowed to set
      insert (body) {
        debug('insert', body)
        if (this._shouldCheckAccess)
          body = this._checkAccess('create', body).filter(body)

        return super.insert(body)
      }

      patch (body) {
        debug('patch', body)
        if (this._shouldCheckAccess)
          body = this._checkAccess('update', body).filter(body)

        return super.patch(body)
      }

      patchAndFetch (body) {
        debug('patchAndFetch', body)
        if (this._shouldCheckAccess)
          body = this._checkAccess('update', body).filter(body)

        return super.patchAndFetch(body)
      }

      patchAndFetchById (id, body) {
        debug('patchAndFetchById', id, body)
        if (this._shouldCheckAccess)
          body = this._checkAccess('update', body).filter(body)

        return super.patchAndFetchById(id, body)
      }

      // istanbul ignore next
      update (body) {
        debug('update', body)
        if (this._shouldCheckAccess)
          body = this._checkAccess('update', body).filter(body)

        return super.update(body)
      }

      // istanbul ignore next
      updateAndFetch (body) {
        debug('updateAndFetch', body)
        if (this._shouldCheckAccess)
          body = this._checkAccess('update', body).filter(body)

        return super.updateAndFetch(body)
      }

      // istanbul ignore next
      updateAndFetchById (id, body) {
        debug('updateAndFetchById', id, body)
        if (this._shouldCheckAccess)
          body = this._checkAccess('update', body).filter(body)

        return super.updateAndFetchById(id, body)
      }

      delete (body) {
        debug('delete', body)
        this._checkAccess('delete', body)

        return super.delete()
      }

      deleteById (id, body) {
        debug('deleteById', id, body)

        return this.findById(id).delete(body)
      }

      // specify a custom action, which takes precedence over the "default" action.
      action (_action) {
        debug('action', _action)
        this.mergeContext({ _action })

        return this
      }

      // result is always an array, so we figure out if we should look at the result
      // as a single object instead by looking at whether .first() was called or not.
      first () {
        debug('first')
        this.mergeContext({ _first: true })

        return super.first()
      }

      // THE magic method that schedules the actual authorization logic to be called
      // later down the line when the query is built and is ready to be executed.
      authorize (user, resource, optOverride) {
        this.mergeContext({
          _user: Object.assign({ role: opts.defaultRole }, user),
          _resource: resource || this.context()._instance || {},
          _opts: Object.assign({}, opts, optOverride),
          _authorize: true
        })
          // This is run AFTER the query has been completely built.
          // In other words, the query already checked create/update/delete access
          // by this point, and the only thing to check now is the read access,
          // IF the resource is specified. Otherwise, it's delayed till the end!
          .runBefore(async (result, query) => {
            if (query.isFind() && !isEmpty(resource)) {
              const readAccess = query._checkAccess('read')

              // store the read access just in case
              query.mergeContext({ readAccess })
            }

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
            // We're trusting that if the query returns an array of results,
            // then you've already filtered it according to the user's read access
            // in the query (instead of relying on the ACL to do it) since it's costly!
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

            readAccess = readAccess || query._checkAccess('read')

            // if we're fetching multiple resources, the result will be an array.
            // While access.filter() accepts arrays, we need to invoke any $formatJson()
            // hooks by individually calling toJSON() on individual models since:
            // 1. arrays don't have toJSON() method,
            // 2. objection-visibility doesn't work without calling $formatJson()
            return isArray
              ? result.map(model => model._filter(readAccess))
              : result._filter(readAccess)
          })

        // for chaining
        return this
      }
    }

    return class extends Model {
      // used to filter model's attributes according to a user's read access.
      // First pick the fields, and then filter them, as per:
      // https://github.com/oscaroox/objection-visibility
      _filter (access) {
        const pickFields = lib.pickFields(access)
        const omitFields = lib.omitFields(access)

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
        return AuthQueryBuilder
      }
    }
  }
}
