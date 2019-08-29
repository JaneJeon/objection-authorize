const fs = require("fs")
const plugin = require(".")
const { Model } = require("objection")
const knexjs = require("knex")
const RoleAcl = require("role-acl")
const AccessControl = require("accesscontrol")

const filename = "./test/db"
fs.unlinkSync(filename)
const knex = knexjs({ client: "sqlite3", connection: { filename } })

Model.knex(knex)

class BaseModel extends Model {
  static get tableName() {
    return "users"
  }
}

// these are some sample grants that you might use for your app in regards to user rights
const anonymous = [
  {
    resource: "users",
    action: "read",
    attributes: ["*", "!email"]
  },
  {
    resource: "users",
    action: "create",
    attributes: ["*", "!id"]
  }
]
const user = [
  {
    resource: "users",
    action: "read",
    attributes: ["*", "!email"]
  },
  {
    resource: "users",
    action: "read",
    attributes: ["email"],
    condition: { Fn: "EQUALS", args: { id: "$.req.user.id" } }
  },
  {
    resource: "users",
    action: "update",
    attributes: ["*", "!id"],
    condition: { Fn: "EQUALS", args: { id: "$.req.user.id" } }
  },
  {
    resource: "users",
    action: "delete",
    condition: { Fn: "EQUALS", args: { id: "$.req.user.id" } }
  }
]

describe("objection-authorize", () => {
  beforeAll(async () => {
    return knex.schema.createTable("users", table => {
      table.increments()
      table.text("username")
      table.text("email")
    })
  })

  test("requires opts.acl", () => {
    expect(plugin()(BaseModel)).toThrow()
  })

  test("errors when you pass the grants object directly", () => {
    expect(plugin({ acl: { user, anonymous } })(BaseModel)).toThrow()
  })

  describe("when using default options", () => {
    const grants = { user, anonymous }

    describe("when using role-acl", () => {
      const acl = new RoleAcl(grants)
      class User extends plugin({ acl })(BaseModel) {}
      let user
      const userData = { username: "hello", email: "foo@bar.com" }

      describe("C", () => {
        test("works", async () => {
          // create test user
          user = await User.query()
            .authorize({})
            .insert(userData)

          // you can't create user while logged in
          expect(
            await User.query()
              .authorize({ user })
              .insert(userData)
          ).toThrow()
        })
      })

      describe("R", () => {
        test("works", () => {
          //
        })
      })

      describe("U", () => {
        test("works", () => {
          //
        })
      })

      describe("D", () => {
        test("works", () => {
          //
        })
      })
    })

    describe("when using accesscontrol", () => {
      const acl = new AccessControl(grants)
      class User extends plugin({ acl })(BaseModel) {}
    })
  })

  describe("when using custom defaultRole", () => {
    const grants = { user, default: anonymous }

    describe("when using role-acl", () => {
      const acl = new RoleAcl(grants)
      class User extends plugin({ acl, defaultRole: "default" })(BaseModel) {}
    })

    describe("when using accesscontrol", () => {
      const acl = new AccessControl(grants)
      class User extends plugin({ acl, defaultRole: "default" })(BaseModel) {}
    })
  })
})
