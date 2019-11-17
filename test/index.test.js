const BaseModel = require('./utils/base-model')
const plugin = require('..')

describe('objection-authorize', () => {
  test('requires acl', () => {
    expect(() => plugin()(BaseModel)).toThrow()
    plugin({})(BaseModel)
  })

  test('specify library', () => {
    expect(() => plugin({}, 'blah')(BaseModel)).toThrow()
  })
})
