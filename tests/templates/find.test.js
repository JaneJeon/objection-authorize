require('../utils/trxify-tests')

const ACLs = require('../acls')
const BaseUser = require('../models/user')
const authorizePlugin = require('../../src')

describe.each(ACLs)('Find tests (acl: %s)', (library, acl) => {
  class User extends authorizePlugin(acl, library)(BaseUser) {}

  test('anonymous access', async () => {
    // read as anonymous should pass, BUT some of the fields should be redacted
    const user = await User.query().findById(1).authorize()
    const serializedUser = user.authorizeRead().toJSON()

    // We expect the (nested) hidden field to be yeeted out by the read access
    expect(serializedUser).toMatchObject({
      id: 1,
      username: 'user1',
      role: 'user',
      metadata: {
        fixedField: 'foo',
        mutableField: 'bar'
      }
    })
  })

  test('authenticated access', async () => {
    const user1 = User.fromJson(
      { id: 1, role: 'user' },
      { skipValidation: true }
    )
    const user1FromDb = await User.query().findById(1).authorize(user1)
    const user2FromDb = await User.query().findById(2).authorize(user1)
    const serializedUser1 = user1FromDb.authorizeRead(user1).toJSON()
    const serializedUser2 = user2FromDb.authorizeRead(user1).toJSON()

    // User 1 should be able to read both the users, but the password should only be visible to himself
    expect(serializedUser1).toMatchObject({
      id: 1,
      username: 'user1',
      password: 'plaintext',
      role: 'user',
      metadata: {
        fixedField: 'foo',
        mutableField: 'bar'
      }
    })
    expect(serializedUser2).toMatchObject({
      id: 2,
      username: 'user2',
      role: 'user',
      metadata: {
        fixedField: 'baz',
        mutableField: '???'
      }
    })
  })
})
