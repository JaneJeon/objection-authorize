const { defineAbility } = require('@casl/ability')

function acl(user, resource, action, body, opts) {
  return defineAbility((allow, forbid) => {
    allow('read', 'User')
    forbid('read', 'User', ['metadata.hiddenField', 'password'])

    if (user.role === 'anonymous') {
      allow('create', 'User')
    } else if (user.role === 'user') {
      allow('read', 'User', ['password'], { id: user.id })
      allow('update', 'User', { id: user.id })
      forbid('update', 'User', ['id', 'metadata.fixedField'])
      allow('delete', 'User', { id: user.id })
    }
  })
}

module.exports = acl
