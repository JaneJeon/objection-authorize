// With role-acl v4.3.2, they brought back synchronous acl checks.
// This is basically the same as role-acl@3 except we now have to append .sync()
// to get the same behaviour of v<4.
const roleAcl3 = require('./role-acl@3')

roleAcl3.getAccess = (acl, user, resource, action, body, opts) =>
  acl
    .can(opts.roleFromUser(user))
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

module.exports = roleAcl3
