// Because role-acl expects all necessary information to stored in a single context object
// when checking access, we have to take everything we have - req.user, req.body, true, false,
// and the resource - and merge it into one.
// Thus, this is a fixed O(NM) cost with regards to N: the number of fields in the resource,
// and M: the number of rules to match.
exports.getAccess = (acl, user, resource, action, body, opts) =>
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
    .on(resource.constructor.name)

exports.isAuthorized = access => access.granted

// We need to separate out the fields to pick and omit from.
// Thus, it's a fixed O(N) cost (again).
// However, we currently have to go over the list (of properties) *twice*,
// once for filtering pickfields, once for omitFields.
// TODO: figure out a way to do this in one pass!
exports.pickFields = access =>
  access.attributes.filter(field => field !== '*' && !field.startsWith('!')) ||
  []

exports.omitFields = access =>
  access.attributes
    .filter(field => field.startsWith('!'))
    .map(field => field.substr(1)) || []
