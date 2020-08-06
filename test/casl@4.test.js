const pluginTest = require('./utils/plugin-test')
const { defineAbility } = require('casl-4')

function acl(user, resource, action, body, opts) {
  return defineAbility((allow, forbid) => {
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

pluginTest(acl, 'casl@4')
