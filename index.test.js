const plugin = require('.')
const { Model } = require('objection')
const visibility = require('objection-visibility').default
const knexjs = require('knex')
const RoleAcl = require('role-acl')

const knex = knexjs({
  client: 'sqlite3',
  connection: { filename: ':memory:' },
  useNullAsDefault: true
})

Model.knex(knex)

class BaseModel extends visibility(Model) {
  static get tableName () {
    return 'users'
  }

  static get hidden () {
    return ['id']
  }
}

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

describe('objection-authorize', () => {
  beforeAll(async () => {
    return knex.schema.createTable('users', table => {
      table.increments()
      table.text('username')
      table.text('email')
      table.text('role')
      table.text('secrethiddenfield')
    })
  })

  test('requires acl', () => {
    expect(() => plugin()(BaseModel)).toThrow()
  })

  test('errors when you pass the grants object directly', () => {
    expect(() => plugin({ user, anonymous })(BaseModel)).toThrow()
  })

  describe('when using default options', () => {
    const acl = new RoleAcl({ user, anonymous })
    class User extends plugin(acl)(BaseModel) {}

    let testUser
    const userData = {
      username: 'hello',
      email: 'foo@bar.com',
      role: 'user',
      secrethiddenfield: 'hello'
    }

    describe('C', () => {
      test('works', async () => {
        // create test user
        testUser = await User.query()
          .authorize(null, null, { userFromResult: true })
          .insertAndFetch(userData)
        expect(testUser.email).toBeDefined()
        expect(testUser.secrethiddenfield).toBeUndefined()

        // you can't create user while logged in
        expect(() =>
          User.query()
            .authorize(testUser)
            .insert(userData)
        ).toThrow()
      })
    })

    describe('R', () => {
      test('works', async () => {
        // shouldn't be able to read email by default
        let result = await User.query()
          .authorize()
          .findById(testUser.id)
        expect(result.email).toBeUndefined()

        // but users can read their own emails
        result = await User.query()
          .authorize(testUser, { id: testUser.id }) // specify resource
          .findById(testUser.id)
        expect(result.email).toBeDefined()
      })

      test('falls back to the result for resource', async () => {
        const result = await User.query()
          .authorize(testUser)
          .findById(testUser.id)
        expect(result.email).toBeDefined()
      })
    })

    describe('U', () => {
      test('works', async () => {
        // an anonymous user shouldn't be able to update registered user's details
        expect(() =>
          testUser
            .$query()
            .authorize(undefined)
            .patch({ username: 'foo' })
        ).toThrow()

        // but a user should be able to update their own details
        testUser = await testUser
          .$query()
          .authorize(testUser, testUser)
          .patchAndFetch({ username: 'bar' })
        expect(testUser.username).toBe('bar')
      })

      // this only works when the ACL is synchronous!
      test('filters any potential changes against the ACL', async () => {
        // you shouldn't be able to update your own id
        await testUser
          .$query()
          .authorize(testUser)
          .patchAndFetch({ id: 395 })

        const firstUser = await User.query().first()
        expect(firstUser.id).toEqual(testUser.id)
      })

      test('does not poison/change the resource parameter', async () => {
        const resource = testUser.$clone()
        await User.query()
          .authorize(testUser, resource)
          .patch({ username: 'baz' })
        expect(resource).toStrictEqual(testUser)
      })

      test('falls back to the model instance for resource', async () => {
        await testUser
          .$query()
          .authorize(testUser)
          .patch({ username: testUser.username })
      })
    })

    describe('D', () => {
      test('can pass in custom context', async () => {
        await User.query()
          .authorize(testUser, testUser)
          .action('delete')
          .patch({ username: 'deleted' })
      })

      test('works', async () => {
        // you shouldn't be able to delete others' accounts
        expect(() =>
          testUser
            .$query()
            .authorize({ role: 'user', id: 2 })
            .delete()
        ).toThrow()

        // but a user should be able to delete their own account
        await testUser
          .$query()
          .authorize(testUser)
          .delete()
      })
    })
  })
})
