const assert = require("http-assert")

module.exports = (opts = { defaultRole: "anonymous" }) => {
  if (!opts.acl) throw new Error("opts.acl is a required parameter!")

  return Model =>
    class extends Model {
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
            const { req, resource } = this.context()
            if (!(req && resource)) return

            // prioritize the body that's passed in.
            // Additionally, since we constructed a new "req" object in authorize(),
            // messing with req's properties won't affect the "actual" request object
            if (body) req.body = body

            // return the access control result
            return (
              opts.acl
                // user role provided by authorize() even for unauthenticated requests
                .can(req.user.role)
                .execute(action)
                .with(Object.assign(resource, { req }))
                .on(this.modelClass().name)
            )
          }

          _checkAccess(access) {
            if (access)
              assert(
                access.granted,
                this.context().req.user.role == opts.defaultRole ? 401 : 403
              )

            // for chaining
            return this
          }

          // a magic method that schedules the actual authorization logic to be called
          // later down the line when the "action method" (insert/patch/delete) is called
          authorize(req, resource, skipFilter) {
            if (!req)
              throw new Error("authorization failed: no request specified")

            const user = req.user || { role: opts.defaultRole }

            // in case of create, resource is necessarily empty, and we don't want
            // to assign it req.body since it will repeat indefinitely!!!
            resource = resource || this.context().instance || {}

            // limit the amount of context to body and user to hopefully reduce
            // the amount of shit that needs to be deep cloned.
            this.mergeContext({ req: { user, body: req.body }, resource })

            // we always check read access because of the returning result
            const access = this._getAccess("read")

            // you generally don't want to skip filter
            if (!skipFilter)
              this.runAfter(result =>
                // if we're fetching multiple resources, the result will be an array.
                // While access.filter() accepts arrays, we need to invoke any $formatJson()
                // hooks by individually calling toJSON() on individual models since:
                // 1. arrays don't have toJSON() method,
                // 2. objection-visibility doesn't work without calling $formatJson()
                Array.isArray(result)
                  ? result.map(model => access.filter(model.toJSON()))
                  : // when doing DELETE operations, the result will be a number,
                  // in which case access.filter balks so we just return that number instead.
                  // Note that we're assuming if the result is an object, then it must be
                  // an instance of Model, 'cause otherwise toJSON() won't be defined!!
                  typeof result === "object"
                  ? access.filter(result.toJSON())
                  : result
              )

            // check if you're even allowed to read
            return this._checkAccess(access)
          }

          insert(body) {
            const access = this._getAccess("create", body)

            return this._checkAccess(access).patch(
              // when authorize() isn't called, access will be empty
              access ? access.filter(body) : body
            )
          }

          patch(body) {
            const access = this._getAccess("update", body)

            return this._checkAccess(access).patch(
              access ? access.filter(body) : body
            )
          }

          delete() {
            const access = this._getAccess("delete")

            return this._checkAccess(access).delete()
          }
        }
      }
    }
}
