const plugin = require('../..')
const knex = require('./knex')

module.exports = (acl, library) => {
  ;[1, 2].forEach(version => {
    describe(`objection v${version}`, () => {
      const BaseModel = require('./base-model')(version)

      class User extends plugin(acl, library)(BaseModel) {
        static get tableName() {
          return `users-${version}-${library}`
        }

        static get hidden() {
          return ['id']
        }
      }

      describe(`${library} plugin`, () => {
        beforeAll(async () => {
          await knex.schema.createTable(User.tableName, table => {
            table.increments()
            table.text('username')
            table.text('email')
            table.text('role')
            table.text('secrethiddenfield')
          })
          await User.fetchTableMetadata()
        })

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
              User.query().authorize(testUser).insert(userData)
            ).toThrow()
          })
        })

        describe('R', () => {
          test('works', async () => {
            // shouldn't be able to read email by default
            let result = await User.query().authorize().findById(testUser.id)
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
              testUser.$query().authorize(undefined).patch({ username: 'foo' })
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
              testUser.$query().authorize({ role: 'user', id: 2 }).delete()
            ).toThrow()

            // but a user should be able to delete their own account
            await testUser.$query().authorize(testUser).delete()
          })

          test("doesn't break non-authorize calls", async () => {
            await User.query().deleteById(5)
          })
        })
      })
    })
  })
}
