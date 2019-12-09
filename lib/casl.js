const { permittedFieldsOf } = require('@casl/ability/extra')

exports.getAccess = (acl, user, resource, action, opts) =>
  acl(user, resource, action)

exports.isAuthorized = (ability, action, subject) =>
  ability.can(action, subject)

exports.filter = (ability, body) => access.filter(body)

exports.pickFields = (ability, action, subject) => permittedFieldsOf(ability)

exports.omitFields = ability => []
