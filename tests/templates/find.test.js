require('../utils/trxify-tests')

const ACLs = require('../acls')
const BaseUser = require('../models/user')
const authorizePlugin = require('../../src')

describe.each(ACLs)('Find queries & serialization (%s)', (library, acl) => {
  class User extends authorizePlugin(acl, library)(BaseUser) {}

  let user
  test('read access w/ anonymous user', async () => {
    user = await User.query().findById(1).authorize()
  })

  test('hidden fields should be filtered out', async () => {
    const serializedUser = user.authorizeRead()

    expect(serializedUser).toHaveProperty('id')
    expect(serializedUser).not.toHaveProperty('metadata.hiddenField')
  })

  let user1FromDb, user2FromDb
  const user1FromJson = { id: 1, role: 'user' }
  test('read access w/ authenticated user', async () => {
    user1FromDb = await User.query().findById(1).authorize(user1FromJson)
    user2FromDb = await User.query().findById(2).authorize(user1FromJson)
  })

  test('fields should be filtered out according to ACL during serialization', async () => {
    const serializedUser1 = user1FromDb.authorizeRead(user1FromJson)
    const serializedUser2 = user2FromDb.authorizeRead(user1FromJson)

    // User 1 should be able to read both the users...
    expect(serializedUser1).toHaveProperty('id')
    expect(serializedUser2).toHaveProperty('id')

    // but the password should only be visible to himself
    expect(serializedUser1).toHaveProperty('password')
    expect(serializedUser2).not.toHaveProperty('password')
  })
})
