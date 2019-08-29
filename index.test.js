const plugin = require(".")
const { Model } = require("objection")
const knexjs = require("knex")
const RoleAcl = require("role-acl")

const knex = knexjs({
  client: "sqlite3",
  connection: { filename: ":memory:" },
  useNullAsDefault: true
})

Model.knex(knex)

class BaseModel extends Model {
  static get tableName() {
    return "users"
  }
}

// these are some sample grants that you might use for your app in regards to user rights
const anonymous = {
  grants: [
    {
      resource: "User",
      action: "read",
      attributes: ["*", "!email"]
    },
    {
      resource: "User",
      action: "create",
      attributes: ["*", "!id"]
    }
  ]
}
const user = {
  grants: [
    {
      resource: "User",
      action: "read",
      attributes: ["*", "!email"]
    },
    {
      resource: "User",
      action: "read",
      attributes: ["email"],
      condition: { Fn: "EQUALS", args: { id: "$.req.user.id" } }
    },
    {
      resource: "User",
      action: "update",
      attributes: ["*", "!id"],
      condition: { Fn: "EQUALS", args: { id: "$.req.user.id" } }
    },
    {
      resource: "User",
      action: "delete",
      condition: { Fn: "EQUALS", args: { id: "$.req.user.id" } }
    }
  ]
}

describe("objection-authorize", () => {
  beforeAll(async () => {
    return knex.schema.createTable("users", table => {
      table.increments()
      table.text("username")
      table.text("email")
    })
  })

  test("requires acl", () => {
    expect(() => plugin()(BaseModel)).toThrow()
  })

  test("errors when you pass the grants object directly", () => {
    expect(() => plugin({ user, anonymous })(BaseModel)).toThrow()
  })

  describe("when using default options", () => {
    const acl = new RoleAcl({ user, anonymous })
    class User extends plugin(acl)(BaseModel) {}

    let testUser
    const userData = { username: "hello", email: "foo@bar.com" }

    describe("C", () => {
      test("works", async () => {
        // create test user
        testUser = await User.query()
          .authorize()
          .insert(userData)
        testUser.role = "user"

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

    describe("R", () => {
      test("works", async () => {
        // shouldn't be able to read email by default
        let result = await User.query()
          .authorize()
          .findById(testUser.id)
        expect(result.email).toBeUndefined()

        // but users can read their own emails
        result = await User.query()
          .authorize(testUser, { id: 1 }) // specify resource
          .findById(testUser.id)
        expect(result.email).toBeDefined()
      })
    })

    describe("U", () => {
      test("works", async () => {
        // an anonymous user shouldn't be able to update registered user's details
        let error
        try {
          await User.query()
            .authorize(undefined, testUser)
            .patch({ username: "foo" })
        } catch (err) {
          error = err
        }
        expect(error)

        // but a user should be able to update their own details
        await User.query()
          .authorize(testUser, { id: 1 })
          .patch({ username: "bar" })
      })
    })

    describe("D", () => {
      test("works", async () => {
        // you shouldn't be able to delete others' accounts
        let error
        try {
          await User.query()
            .authorize({ role: "user", id: 2 }, testUser)
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

  describe("when using custom defaultRole", () => {
    const acl = new RoleAcl({ user, default: anonymous })
    class User extends plugin(acl, { defaultRole: "default" })(BaseModel) {}
    // TODO:
  })

  // TODO: add $query() and $relatedQuery() tests
})
