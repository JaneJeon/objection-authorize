const casl = process.env.OBJECTION_AUTHORIZE_TEST_MODULE
  ? 'casl-3'
  : '@casl/ability'
const { permittedFieldsOf } = require(`${casl}/extra`)

// O(M) with regards to the number of rules to match.
// Note, however, that since we know what the resource is beforehand,
// we can cut down the number of rules that need to be encoded in the acl
// by a factor of n where n is the number of resources.
exports.getAccess = (acl, user, resource, action, body, opts) =>
  acl(user, resource, action, body, opts)

// O(M/nm) where m is the number of actions (typically 4)
exports.isAuthorized = (ability, action, resource) =>
  ability.can(action, resource)

// While role-acl is able to "infer" that ['*', '!email'] + ['email'] = '*', casl cannot.
// In casl world, the same equation comes out to ['email'], so we need to provide ALL the fields
// for a given model when picking fields (remember, casl does not have any concept of "exclusions",
// e.g. '!email'). The model *itself* doesn't have all of the necessary field information;
// however, Objection has methods to fetch the fields by actually querying the database with knex
// and caching it; and here, we're just fetching the cached metadata and extracting the fields.
// Unfortunately, having to iterate thru every single field means we're incurring a fixed
// O(N) cost with regards to the number of fields.
exports.pickFields = (ability, action, resource) =>
  permittedFieldsOf(ability, action, resource, {
    fieldsFrom: rule =>
      rule.fields || (resource.constructor.tableMetadata() || {}).columns
  }) // pass fields of inputs

exports.omitFields = () => []
