const { defineAbility } = require('@casl/ability')

function acl(user, resource, action, body, opts, relation) {
  // check that both the item and the inputItem are wrapped in model class
  if (resource.modelProperty !== 'something')
    throw new Error('resource is NOT an instance of User class')
  if (relation === 'pets') {
    if (body.modelProperty !== 'something2')
      throw new Error('input is NOT an instance of Pet class')
  } else if (body.modelProperty !== 'something')
    throw new Error('input is NOT an instance of User class')

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

    if (relation === 'pets') {
      //
    } else if (relation === 'owner') {
      //
    }
  })
}

module.exports = acl
