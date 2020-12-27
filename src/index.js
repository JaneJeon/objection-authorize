const pick = require('lodash/pick')

async function fillResourceContext(args) {
  if (!args.context._fetchResourceContextFromDB) return

  const OGValue = args.context._authorize
  args.context._authorize = false
  args.context._resource = await args.asFindQuery()
  args.context._authorize = OGValue
}

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
    class AuthZQueryBuilder extends Model.QueryBuilder {
      // specify a custom action, which takes precedence over the "default" action.
      action(_action) {
        return this.context({ _action })
      }

      // THE magic method that schedules the actual authorization logic to be called
      // later down the line when the query is built and is ready to be executed.
      authorize(user, resource, optOverride) {
        return this.context({
          _user: Object.assign({ role: opts.defaultRole }, user),
          _opts: Object.assign({}, opts, optOverride),
          _resource: resource,
          _class: this.modelClass(),
          _authorize: true
        })
      }

      fetchResourceContextFromDB() {
        return this.context({
          _fetchResourceContextFromDB: true
        })
      }
    }

    return class extends Model {
      static get QueryBuilder() {
        return AuthZQueryBuilder
      }

      static async beforeInsert(args) {
        await super.beforeInsert(args)
        new Adapter(acl, args, 'create').checkAccess()
      }

      static async beforeFind(args) {
        await super.beforeFind(args)
        new Adapter(acl, args, 'read').checkAccess()
      }

      static async beforeUpdate(args) {
        await super.beforeUpdate(args)
        await fillResourceContext(args)
        new Adapter(acl, args, 'update').checkAccess()
      }

      static async beforeDelete(args) {
        await super.beforeDelete(args)
        await fillResourceContext(args)
        new Adapter(acl, args, 'delete').checkAccess()
      }

      // Explicit model instance call to check read access before serializing
      // instance.authorizeRead(req.user[, action = 'read']).toJSON()
      authorizeRead(user, action = 'read', optOverride) {
        const args = {
          items: [],
          inputItems: [],
          relation: '',
          context: {
            _user: Object.assign({ role: opts.defaultRole }, user),
            _opts: Object.assign({}, opts, optOverride),
            _action: action,
            _resource: this,
            _class: this.constructor,
            _authorize: true
          }
        }

        const fields = new Adapter(acl, args, action).allowedFields

        // using lodash's implementation of pick instead of "internal" Objection.js one
        // because the ORM's implementation is absolute shit and buggy as fuck:
        // https://git.io/JLMsm
        return pick(this.toJSON(), fields)
      }
    }
  }
}
