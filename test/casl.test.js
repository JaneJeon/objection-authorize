const pluginTest = require('./utils/plugin-test')
const { AbilityBuilder, Ability } = require('@casl/ability')

// TODO: do I need to put the deny before or after the allow?
function acl (user, resource, action, ctx) {
  return AbilityBuilder.define((allow, forbid) => {
    allow('read', 'User')
    forbid('read', 'User', ['email', 'secrethiddenfield'])

    if (user.role === 'anonymous') {
      allow('create', 'User')
    } else if (user.role === 'user') {
      allow('read', 'User', ['email'], { id: user.id })
      allow('update', 'User', { id: user.id })
      forbid('update', 'User', ['id'])
      allow('delete', 'User', { id: user.id })
    }
  })
}

pluginTest(acl, 'casl')
