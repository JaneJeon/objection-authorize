const objectDiff = require('./object-diff')

describe('objectDiff', () => {
  test('scalars', () => {
    expect(objectDiff('a', 'b')).toEqual({})
    expect(objectDiff(true, true)).toEqual({})
  })

  // we're being lazy here and NOT comparing arrays!
  test('arrays', () => {
    expect(objectDiff(['a', 'b'], ['b', 'c'])).toEqual({})
  })

  test('mixed types', () => {
    expect(objectDiff({ a: 1 }, 'b')).toEqual({})
  })

  test('basic objects', () => {
    expect(
      objectDiff(
        {
          a: 1,
          b: 2,
          c: 3,
          d: { 5: 6 },
          e: [true, false]
        },
        {
          b: 2,
          c: 4,
          d: 5,
          e: [true, false] // ditto
        }
      )
    ).toEqual({
      c: 4,
      d: 5,
      e: [true, false]
      // again, if there's a "diff" in array the whole thing's going on the list because idgaf
    })
  })

  test('nested objects', () => {
    expect(
      objectDiff(
        {
          a: {
            a1: {
              a11: {
                b: 'c',
                d: { e: 'f' }
              },
              a12: [1, 2, 3]
            },
            a2: false
          },
          b: 1,
          c: 2
        },
        {
          a: {
            a1: {
              a11: {
                b: 'c',
                d: 'e'
              },
              a12: [1, 2, 3]
            },
            a2: false
          },
          b: 1,
          c: '2'
        }
      )
    ).toEqual({
      a: {
        a1: {
          a11: {
            d: 'e'
          },
          a12: [1, 2, 3]
        }
      },
      c: '2'
    })
  })
})
