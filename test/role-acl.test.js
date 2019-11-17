const pluginTest = require('./utils/plugin-test')
const RoleAcl = require('role-acl')

// these are some sample grants that you might use for your app in regards to user rights
const anonymous = {
  grants: [
    {
      resource: 'User',
      action: 'read',
      attributes: ['*', '!email', '!secrethiddenfield']
    },
    {
      resource: 'User',
      action: 'create',
      attributes: ['*', '!id']
    }
  ]
}

const user = {
  grants: [
    {
      resource: 'User',
      action: 'read',
      attributes: ['*', '!email', '!secrethiddenfield']
    },
    {
      resource: 'User',
      action: 'read',
      attributes: ['email'],
      condition: { Fn: 'EQUALS', args: { id: '$.req.user.id' } }
    },
    {
      resource: 'User',
      action: 'update',
      attributes: ['*', '!id'],
      condition: { Fn: 'EQUALS', args: { id: '$.req.user.id' } }
    },
    {
      resource: 'User',
      action: 'delete',
      condition: { Fn: 'EQUALS', args: { id: '$.req.user.id' } }
    }
  ]
}

pluginTest(new RoleAcl({ user, anonymous }), 'role-acl')
