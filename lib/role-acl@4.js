// With role-acl v4.3.2, they brought back synchronous acl checks.
// This is basically the same as role-acl@3 except we now have to append .sync()
exports.getAccess = (acl, user, resource, action, body, opts) =>
  acl
    .can(opts.roleFromUser(user)) // role
    .execute(action)
    .context(
      Object.assign(
        {},
        { [opts.contextKey]: { user, body } },
        opts.resourceAugments,
        resource
      )
    )
    .sync()
    .on(resource.constructor.name)

exports.isAuthorized = access => access.granted

exports.pickFields = access =>
  access.attributes.filter(field => field !== '*' && !field.startsWith('!')) ||
  []

exports.omitFields = access =>
  access.attributes
    .filter(field => field.startsWith('!'))
    .map(field => field.substr(1)) || []
