const assert = require("http-assert")

module.exports = (opts = { defaultRole: "anonymous" }) => {
  if (!opts.acl) throw new Error("opts.acl is a required parameter!")
  if (typeof opts.acl.can != "function")
    throw new Error(
      "you likely passed the grants object directly instead of the access control instnace"
    )

  return Model => {
    return class extends Model {
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
          _getAccess(action, body) {
            const { user, resource } = this.context()

            if (user && resource) {
              // return the access control result
              return (
                opts.acl
                  .can(user.role)
                  .execute(action)
                  .context(Object.assign(resource, { req: { user, body } }))
                  // resource name defaults to the model class's name.
                  // TODO: provide option for this
                  .on(this.modelClass().name)
              )
            }
          }

          _checkAccess(access) {
            if (access)
              assert(
                access.granted,
                this.context().user.role == opts.defaultRole ? 401 : 403
              )

            // for chaining
            return this
          }

          // a magic method that schedules the actual authorization logic to be called
          // later down the line when the "action method" (insert/patch/delete) is called
          authorize(
            user = { role: opts.defaultRole },
            resource = this.context().instance
          ) {
            return this.mergeContext({ user, resource })
              .runBefore((result, query) => {
                // this is run AFTER the query has been completely built.
                // In other words, the query already checked create/update/delete access
                // by this point, and the only thing to check now is the read access
                if (query.isRead()) {
                  const readAccess = query._getAccess("read")
                  query._checkAccess(readAccess)

                  // store the read access just in case
                  query.mergeContext({ readAccess })
                }

                return result
              })
              .runAfter((result, query) => {
                const isArray = Array.isArray(result)
                const isObj = typeof result === "object"

                // there's no result object(s) to filter here
                if (!(isArray || isObj)) return result

                const readAccess =
                  query.context().readAccess || query._getAccess("read")

                // TODO: pick
                return isArray
                  ? // if we're fetching multiple resources, the result will be an array.
                    // While access.filter() accepts arrays, we need to invoke any $formatJson()
                    // hooks by individually calling toJSON() on individual models since:
                    // 1. arrays don't have toJSON() method,
                    // 2. objection-visibility doesn't work without calling $formatJson()
                    result.map(model => readAccess.filter(model.toJSON()))
                  : // here, we're assuming that if the result is an object, then it must be
                    // an instance of Model, because otherwise toJSON() won't be defined!!
                    readAccess.filter(result.toJSON())
              })
          }

          // automatically checks if you can create this resource, and if yes,
          // restricts the body object to only the fields they're allowed to set
          insert(body) {
            const access = this._getAccess("create", body)

            return this._checkAccess(access).patch(
              // when authorize() isn't called, access will be empty
              access ? access.filter(body) : body
            )
          }

          // automatically checks if you can update this resource, and if yes,
          // restricts the body object to only the fields they're allowed to set
          patch(body) {
            const access = this._getAccess("update", body)

            return this._checkAccess(access).patch(
              access ? access.filter(body) : body
            )
          }

          // automatically checks if you can delete this resource
          delete() {
            const access = this._getAccess("delete")

            return this._checkAccess(access).delete()
          }
        }
      }
    }
  }
}
