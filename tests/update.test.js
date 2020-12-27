require('./utils/trxify-tests')

const ACLs = require('./acls')
const BaseUser = require('./models/user')
const authorizePlugin = require('../src')

describe.each(ACLs)('Update queries (%s)', (library, acl) => {
  class User extends authorizePlugin(acl, library)(BaseUser) {}

  test('restrict access with automatically fetched context', async () => {
    // you shouldn't be able to delete a user as someone else...
    // for update, need to "filter out" fields from the item that are the same
    await expect(
      User.query()
        .findById(1)
        .update({ id: 1, metadata: { mutableField: 'hello!' } })
        .authorize({ id: 2, role: 'user' })
        .fetchResourceContextFromDB()
        .diffInputFromResource()
    ).rejects.toThrow()

    // but a user should be able to delete their own account
    await User.query()
      .findById(2)
      .update({ id: 2, metadata: { mutableField: 'hello!' } })
      .authorize({ id: 2, role: 'user' })
      .fetchResourceContextFromDB()
      .diffInputFromResource()
  })

  test('restrict access with manually passed context', async () => {
    // you shouldn't be able to delete a user as someone else...
    await expect(
      User.query()
        .findById(1)
        .update({ id: 1, metadata: { mutableField: 'hello!' } })
        .authorize({ id: 2, role: 'user' }, { id: 1 })
        .diffInputFromResource()
    ).rejects.toThrow()

    // but a user should be able to delete their own account
    await User.query()
      .findById(1)
      .update({ metadata: { mutableField: 'hello!' } })
      .authorize({ id: 2, role: 'user' }, { id: 2 })
      .diffInputFromResource()
  })

  test('prevent setting an invalid field', async () => {
    await expect(
      User.query()
        .updateAndFetchById(1, { id: 1, metadata: { fixedField: 'whoops!' } })
        .authorize({ id: 1, role: 'user' }, { id: 1 })
        .diffInputFromResource()
    ).rejects.toThrow()
  })
})
