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
    expect(objectDeepKeys({ a: 1, b: 2 })).toEqual(['a', 'b'])
  })

  test('nested objects', () => {
    expect(objectDeepKeys({ a: { b: 'c' }, d: 'e' })).toEqual(['d', 'a.b'])
  })

  test('nested scalars and arrays', () => {
    expect(objectDeepKeys({ a: { b: [{ c: 'd' }], e: false } })).toEqual([
      'a.b',
      'a.e'
    ])
  })
})
