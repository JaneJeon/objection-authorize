exports.getAccess = (acl, user, resourceName, resource, action, ctx) =>
  acl
    .can(user.role)
    .execute(action)
    .context(ctx)
    .on(resourceName)

exports.isAuthorized = access => access.granted

exports.filter = (access, body) => access.filter(body)

exports.pickFields = access =>
  access.attributes.filter(field => field !== '*' && !field.startsWith('!')) ||
  []

exports.omitFields = access =>
  access.attributes
    .filter(field => field.startsWith('!'))
    .map(field => field.substr(1)) || []
