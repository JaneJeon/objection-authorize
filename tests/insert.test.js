const ACLs = require('./acls')
const BaseUser = require('./models/user')
const authorizePlugin = require('../src')

describe.each(ACLs)('Insert queries (%s)', (library, acl) => {
  class User extends authorizePlugin(acl, library, {
    ignoreFields: ['created_at', 'updated_at']
  })(BaseUser) {}

  test('restrict insert query based on their create access', async () => {
    // create user while anonymous
    await User.query().authorize().insert({ id: 3 })

    // can't create user while logged in
    await expect(
      User.query().authorize({ id: 4, role: 'user' }).insert({ id: 5 })
    ).rejects.toThrow()
  })

  test('prevents inputItems from being affected', async () => {
    await User.query().authorize().insert({ id: 3 })

    // Make sure created_at was not stripped away
    const user = await User.query().findById(3)
    expect(user.created_at).toBeTruthy()
  })
})
