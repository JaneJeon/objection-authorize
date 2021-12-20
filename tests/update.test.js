const ACLs = require('./acls')
const BaseUser = require('./models/user')
const authorizePlugin = require('../src')

describe.each(ACLs)('Update queries (%s)', (library, acl) => {
  class User extends authorizePlugin(acl, library, {
    ignoreFields: ['created_at', 'updated_at']
  })(BaseUser) {}

  test('restrict access with automatically fetched context', async () => {
    // you shouldn't be able to change a user as someone else...
    // for update, need to "filter out" fields from the item that are the same
    await expect(
      User.query()
        .findById(1)
        .update({ id: 1, metadata: { mutableField: 'hello!' } })
        .authorize({ id: 2, role: 'user' })
        .fetchResourceContextFromDB()
        .diffInputFromResource()
    ).rejects.toThrow()

    // but a user should be able to change their own account
    await User.query()
      .findById(2)
      .update({ id: 2, metadata: { mutableField: 'hello!' } })
      .authorize({ id: 2, role: 'user' })
      .fetchResourceContextFromDB()
      .diffInputFromResource()
  })

  test('restrict access with manually passed context', async () => {
    // you shouldn't be able to change a user as someone else...
    await expect(
      User.query()
        .findById(1)
        .update({ id: 1, metadata: { mutableField: 'hello!' } })
        .authorize({ id: 2, role: 'user' }, { id: 1 })
        .diffInputFromResource()
    ).rejects.toThrow()

    // but a user should be able to change their own account
    await User.query()
      .findById(2)
      .update({ id: 2, metadata: { mutableField: 'hello!' } })
      .authorize({ id: 2, role: 'user' }, { id: 2 })
      .diffInputFromResource()
  })

  test('fetches resource from model instance', async () => {
    const user = await User.query().findById(1)

    await expect(
      user
        .$query()
        .update({ id: 1, metadata: { mutableField: 'hello' } })
        .authorize({ id: 2, role: 'user' })
        .diffInputFromResource()
    ).rejects.toThrow()

    await user
      .$query()
      .update({ id: 1, metadata: { mutableField: 'hello!' } })
      .authorize({ id: 1, role: 'user' })
      .diffInputFromResource()
  })

  test('prevent setting an invalid field', async () => {
    await expect(
      User.query()
        .updateAndFetchById(1, { id: 1, metadata: { fixedField: 'whoops!' } })
        .authorize({ id: 1, role: 'user' }, { id: 1 })
        .diffInputFromResource()
    ).rejects.toThrow()

    await User.query()
      .updateAndFetchById(1, { id: 1, metadata: { mutableField: 'hello' } })
      .authorize({ id: 1, role: 'user' }, { id: 1 })
      .diffInputFromResource()
  })

  test('do not modify inputItems', async () => {
    // eslint-disable-next-line camelcase
    const created_at = new Date()

    const user = await User.query()
      .updateAndFetchById(1, {
        id: 1,
        metadata: { mutableField: 'hello' },
        created_at
      })
      .authorize({ id: 1, role: 'user' }, { id: 1 })
      .diffInputFromResource()

    // eslint-disable-next-line camelcase
    expect(user.created_at === created_at)
    expect(user.updated_at).toBeTruthy()
  })
})
