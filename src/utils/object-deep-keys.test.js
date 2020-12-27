const objectDeepKeys = require('./object-deep-keys')

describe('objectDeepKeys', () => {
  test('scalars', () => {
    expect(objectDeepKeys('string')).toEqual([])
    expect(objectDeepKeys(10)).toEqual([])
    expect(objectDeepKeys(true)).toEqual([])
  })

  test('arrays', () => {
    expect(objectDeepKeys(['a', 'b', 'c'])).toEqual([])
    expect(objectDeepKeys([{ hello: 'world' }])).toEqual([])
  })

  test('simple objects', () => {
    expect(objectDeepKeys({ a: 1, b: 2 }).sort()).toEqual(['a', 'b'].sort())
  })

  test('nested objects', () => {
    expect(objectDeepKeys({ a: { b: 'c' }, d: 'e' }).sort()).toEqual(
      ['a.b', 'd'].sort()
    )
    expect(objectDeepKeys({ a: { b: 'c' } })).toEqual(['a.b'])
  })

  test('nested scalars and arrays', () => {
    expect(objectDeepKeys({ a: { b: [{ c: 'd' }], e: false } }).sort()).toEqual(
      ['a.b', 'a.e'].sort()
    )
  })
})
