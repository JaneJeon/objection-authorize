const ACLs = require('./acls')
const BaseUser = require('./models/user')
const authorizePlugin = require('../src')

describe.each(ACLs)('Patch queries (%s)', (library, acl) => {
  class User extends authorizePlugin(acl, library, {
    ignoreFields: ['created_at', 'updated_at']
  })(BaseUser) {}

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
    // you shouldn't be able to change a user as someone else...
    await expect(
      User.query()
        .findById(1)
        .patch({ metadata: { mutableField: 'hello!' } })
        .authorize({ id: 2, role: 'user' }, { id: 1 })
    ).rejects.toThrow()

    // but a user should be able to change their own account
    await User.query()
      .findById(2)
      .patch({ metadata: { mutableField: 'hello!' } })
      .authorize({ id: 2, role: 'user' }, { id: 2 })
  })

  test('fetches resource from model instance', async () => {
    const user = await User.query().findById(1)

    await expect(
      user
        .$query()
        .patch({ metadata: { mutableField: 'hello' } })
        .authorize({ id: 2, role: 'user' })
    ).rejects.toThrow()

    await user
      .$query()
      .patch({ metadata: { mutableField: 'hello!' } })
      .authorize({ id: 1, role: 'user' })
  })

  test('prevent setting an invalid field', async () => {
    await expect(
      User.query()
        .patchAndFetchById(1, { metadata: { fixedField: 'whoops!' } })
        .authorize({ id: 1, role: 'user' }, { id: 1 })
    ).rejects.toThrow()

    // also testing patchAndFetchById
    await User.query()
      .patchAndFetchById(1, { metadata: { mutableField: 'hello' } })
      .authorize({ id: 1, role: 'user' }, { id: 1 })
  })

  test('prevent inputItems from being affected', async () => {
    await User.query()
      .findById(2)
      .patch({ metadata: { mutableField: 'hello!' } })
      .authorize({ id: 2, role: 'user' })
      .fetchResourceContextFromDB()

    // Make sure created_at was not stripped away
    const user = await User.query().findById(2)
    expect(user.created_at).toBeTruthy()
    expect(user.updated_at).toBeTruthy()
  })
})
