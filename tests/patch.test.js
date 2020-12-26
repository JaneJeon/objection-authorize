require('./utils/trxify-tests')

const ACLs = require('./acls')
const BaseUser = require('./models/user')
const authorizePlugin = require('../src')

describe.each(ACLs)('Patch queries (%s)', (library, acl) => {
  class User extends authorizePlugin(acl, library)(BaseUser) {}

  test('restrict access with automatically fetched context', async () => {
    // you shouldn't be able to delete a user as someone else...
    await expect(
      User.query()
        .findById(1)
        .patch({ metadata: { mutableField: 'hello!' } })
        .authorize({ id: 2, role: 'user' })
        .fetchResourceContextFromDB()
    ).rejects.toThrow()

    // but a user should be able to delete their own account
    await User.query()
      .findById(2)
      .patch({ metadata: { mutableField: 'hello!' } })
      .authorize({ id: 2, role: 'user' })
      .fetchResourceContextFromDB()
  })

  test('restrict access with manually passed context', async () => {
    // you shouldn't be able to delete a user as someone else...
    await expect(
      User.query()
        .findById(1)
        .patch({ metadata: { mutableField: 'hello!' } })
        .authorize({ id: 2, role: 'user' }, { id: 1 })
    ).rejects.toThrow()

    // but a user should be able to delete their own account
    await User.query()
      .findById(1)
      .patch({ metadata: { mutableField: 'hello!' } })
      .authorize({ id: 2, role: 'user' }, { id: 2 })
  })

  test('prevent setting an invalid field', async () => {
    await expect(
      User.query()
        .patchAndFetchById(1, { id: 1, metadata: { fixedField: 'whoops!' } })
        .authorize({ id: 1, role: 'user' }, { id: 1 })
    ).rejects.toThrow()
  })
})
