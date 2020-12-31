require('./utils/trxify-tests')

const ACLs = require('./acls')
const BaseUser = require('./models/user')
const BasePet = require('./models/pet')
const authorizePlugin = require('../src')

describe.each(ACLs)('Relation queries (%s)', (library, acl) => {
  class User extends authorizePlugin(acl, library)(BaseUser) {}
  class Pet extends authorizePlugin(acl, library)(BasePet) {}

  test.skip('relation find queries', async () => {
    const user = await User.query().findById(1)
    await user.$relatedQuery('pets').authorize({ id: 1 })

    // await User.relatedQuery('pets').authorize({ id: 1 }).for(1)

    expect(
      await User.relatedQuery('pets').authorize({ id: 1 }).for(2)
    ).rejects.toThrow()
  })

  test.skip('relation insert queries', async () => {
    await User.relatedQuery('pets')
      .authorize({ id: 1 })
      .for(1)
      .insert({ name: 'fluffy' })

    expect(
      await User.relatedQuery('pets')
        .authorize({ id: 1 })
        .for(2)
        .insert({ name: 'fluffy' })
    ).rejects.toThrow()
  })

  test.skip('relation relate/unrelate queries', async () => {
    const fluffy = await Pet.query().insert({ name: 'fluffy' })

    await fluffy.$relatedQuery('owner').relate(1)
    await fluffy.$relatedQuery('owner').unrelate(1)
  })

  test.skip('relation update queries', async () => {
    //
  })

  test.skip('relation delete queries', async () => {
    //
  })
})
