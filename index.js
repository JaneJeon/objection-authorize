const assert = require('http-assert')
const isEmpty = obj => !Object.keys(obj || {}).length
const pick = require('lodash.pick')
const omit = require('lodash.omit')

module.exports = (acl, library = 'role-acl', opts) => {
  if (!acl) throw new Error('acl is a required parameter!')
  if (typeof library === 'object') {
    throw new Error(
      'objection-authorize@3 now has the signature (acl, library, opts)'
    )
  }

  const defaultOpts = {
    defaultRole: 'anonymous',
    unauthenticatedErrorCode: 401,
    unauthorizedErrorCode: 403,
    userFromResult: false,
    // below are role-acl specific options
    contextKey: 'req',
    roleFromUser: user => user.role,
    resourceAugments: { true: true, false: false, undefined: undefined }
  }
  opts = Object.assign(defaultOpts, opts)

  const lib = require(`./lib/${library}`)

  return Model => {
    class AuthQueryBuilder extends Model.QueryBuilder {
      get _shouldCheckAccess () {
        return this.context()._authorize
      }

      // Wrap the resource to give it all the custom methods & properties
      // defined in the associating model class (e.g. Post, User).
      set _resource (_resource) {
        // Wrap the resource only if it's not an instance of a model already.
        // Rather than checking if the resource is instance of the Model base class,
        // we are simply checking that the resource has a $query property.
        if (!_resource || !_resource.$query)
          _resource = this.modelClass().fromJson(_resource, {
            skipValidation: true
          })
        this.mergeContext({ _resource })
      }

      // wrappers around acl, querybuilder, and model
      _checkAccess (action, body) {
        const {
          _user: user,
          _resource: resource,
          _opts: opts,
          _action
        } = this.context()
        // allowed the specified action to override the default, inferred action
        action = _action || action

        const access = lib.getAccess(acl, user, resource, action, body, opts)

        // authorize request
        assert(
          lib.isAuthorized(access, action, resource),
          user.role === opts.defaultRole
            ? opts.unauthenticatedErrorCode
            : opts.unauthorizedErrorCode
        )

        return access
      }

      // convenience helper for insert/update/delete
      _filterBody (action, body) {
        if (!this._shouldCheckAccess) return body

        const access = this._checkAccess(action, body)
        const { _resource: resource } = this.context()

        // there's no need to cache these fields because this isn't the read access.
        const pickFields = lib.pickFields(access, action, resource)
        const omitFields = lib.omitFields(access, action, resource)

        if (pickFields.length) body = pick(body, pickFields)
        if (omitFields.length) body = omit(body, omitFields)

        return body
      }

      // insert/patch/update/delete are the "primitive" query actions.
      // All other methods like insertAndFetch or deleteById are built on these.

      // automatically checks if you can create this resource, and if yes,
      // restricts the body object to only the fields they're allowed to set.
      insert (body) {
        return super.insert(this._filterBody('create', body))
      }

      insertAndFetch (body) {
        return super.insertAndFetch(this._filterBody('create', body))
      }

      patch (body) {
        return super.patch(this._filterBody('update', body))
      }

      patchAndFetch (body) {
        return super.patchAndFetch(this._filterBody('update', body))
      }

      // istanbul ignore next
      patchAndFetchById (id, body) {
        return super.patchAndFetchById(id, this._filterBody('update', body))
      }

      // istanbul ignore next
      update (body) {
        return super.update(this._filterBody('update', body))
      }

      // istanbul ignore next
      updateAndFetch (body) {
        return super.updateAndFetch(this._filterBody('update', body))
      }

      // istanbul ignore next
      updateAndFetchById (id, body) {
        return super.updateAndFetchById(id, this._filterBody('update', body))
      }

      delete (body) {
        this._checkAccess('delete', body)
        return super.delete()
      }

      // istanbul ignore next
      deleteById (id, body) {
        this._checkAccess('delete', body)
        return super.deleteById(id)
      }

      // specify a custom action, which takes precedence over the "default" action.
      action (_action) {
        this.mergeContext({ _action })
        return this
      }

      // result is always an array, so we figure out if we should look at the result
      // as a single object instead by looking at whether .first() was called or not.
      first () {
        this.mergeContext({ _first: true })
        return super.first()
      }

      // THE magic method that schedules the actual authorization logic to be called
      // later down the line when the query is built and is ready to be executed.
      authorize (user, resource, optOverride) {
        resource = resource || this.context()._instance || {}
        this._resource = resource
        this.mergeContext({
          _user: Object.assign({ role: opts.defaultRole }, user),
          _opts: Object.assign({}, opts, optOverride),
          _authorize: true
        })
          // This is run AFTER the query has been completely built.
          // In other words, the query already checked create/update/delete access
          // by this point, and the only thing to check now is the read access,
          // IF the resource is specified.
          // Otherwise, we check the read access after the query has been run, on the
          // query results as the resource.
          .runBefore(async (result, query) => {
            if (query.isFind() && !isEmpty(resource)) {
              const readAccess = query._checkAccess('read')

              // store the read access so that it can be reused after the query.
              query.mergeContext({ readAccess })
            }

            return result
          })
          .runAfter(async (result, query) => {
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
              query.mergeContext({ _resource: resource })
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
              ? result.map(model => model._filterModel(readAccess))
              : result._filterModel(readAccess)
          })

        // for chaining
        return this
      }
    }

    return class extends Model {
      // filter the model instance directly
      _filterModel (readAccess) {
        const pickFields = lib.pickFields(readAccess, 'read', this)
        const omitFields = lib.omitFields(readAccess, 'read', this)

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
