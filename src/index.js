const pick = require('lodash/pick')
const merge = require('lodash/merge')

// TODO: @sssss465 I mean like this kind of shit
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
    unauthorizedErrorCode: 403,
    castDiffToModelClass: true,
    casl: {
      useInputItemAsResourceForRelation: false
    },
    ignoreFields: []
  }
  opts = merge({}, defaultOpts, opts)

  const Adapter = require(`./adapters/${library}`)

  return Model => {
    class AuthZQueryBuilder extends Model.QueryBuilder {
      action(_action) {
        return this.context({ _action })
      }

      inputItem(_resource) {
        return this.context({ _resource })
      }

      authorize(user, resource, optOverride) {
        const _opts = merge({}, opts, optOverride)

        return this.context({
          _user: merge({ role: _opts.defaultRole }, user),
          _opts,
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

      diffInputFromResource() {
        return this.context({
          _diffInputFromResource: true
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

      authorizeRead(user, action = 'read', optOverride) {
        const args = {
          items: [],
          inputItems: [],
          relation: '',
          context: {
            _user: merge({ role: opts.defaultRole }, user),
            _opts: merge({}, opts, optOverride),
            _action: action,
            _resource: this,
            _class: this.constructor,
            _authorize: true
          }
        }

        const fields = new Adapter(acl, args, action).allowedFields

        // using lodash's implementation of pick instead of "internal" Objection.js one
        // because the ORM's implementation doesn't support nested JSON:
        // https://git.io/JLMsm
        return pick(this.toJSON(), fields)
      }
    }
  }
}
