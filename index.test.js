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
      attributes: ['*', '!email']
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
      attributes: ['*', '!email']
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
    const userData = { username: 'hello', email: 'foo@bar.com', role: 'user' }

    describe('C', () => {
      test('works', async () => {
        // create test user
        testUser = await User.query()
          .authorize(null, null, { userFromResult: true })
          .insert(userData)
        expect(testUser.email).toBeDefined()

        // you can't create user while logged in
        let error
        try {
          await User.query()
            .authorize(testUser)
            .insert(userData)
        } catch (err) {
          error = err
        }
        expect(error)
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
        let error
        try {
          await User.query()
            .authorize(undefined, testUser)
            .patch({ username: 'foo' })
        } catch (err) {
          error = err
        }
        expect(error)

        // but a user should be able to update their own details
        await User.query()
          .authorize(testUser, { id: 1 })
          .patch({ username: 'bar' })
      })

      test('does not poison/change the resource parameter', async () => {
        const resource = testUser.$clone()
        await User.query()
          .authorize(testUser, resource)
          .patch({ username: 'baz' })
        expect(resource).toStrictEqual(testUser)
      })

      test('falls back to the model instance for resource', async () => {
        const user = await User.query().findById(testUser.id)
        await user
          .$query()
          .authorize(testUser)
          .patch({ username: testUser.username })
      })
    })

    describe('D', () => {
      test('works', async () => {
        // you shouldn't be able to delete others' accounts
        let error
        try {
          await User.query()
            .authorize({ role: 'user', id: 2 }, testUser)
            .deleteById(1)
        } catch (err) {
          error = err
        }
        expect(error)

        // but a user should be able to delete their own account
        await User.query()
          .authorize(testUser, { id: 1 })
          .deleteById(1)
      })
    })
  })
})
