require('./utils/trxify-tests')

const ACLs = require('./acls')
const BaseUser = require('./models/user')
const authorizePlugin = require('../src')

describe.each(ACLs)('Delete queries (%s)', (library, acl) => {
  class User extends authorizePlugin(acl, library)(BaseUser) {}

  test('restrict access with automatically fetched context', async () => {
    // you shouldn't be able to delete a user as someone else...
    await expect(
      User.query()
        .deleteById(1)
        .authorize({ id: 2, role: 'user' })
        .fetchResourceContextFromDB()
    ).rejects.toThrow()

    // but a user should be able to delete their own account
    await User.query()
      .deleteById(2)
      .authorize({ id: 2, role: 'user' })
      .fetchResourceContextFromDB()
  })

  test('restrict access with manually passed context', async () => {
    // you shouldn't be able to delete a user as someone else...
    await expect(
      User.query().deleteById(1).authorize({ id: 2, role: 'user' }, { id: 1 })
    ).rejects.toThrow()

    // but a user should be able to delete their own account
    await User.query()
      .deleteById(2)
      .authorize({ id: 2, role: 'user' }, { id: 2 })
  })
})
