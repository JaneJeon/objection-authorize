// Given objects A (base) and B (test), returns a new object
// with set difference of B - A;
// i.e. an object with fields of B that are either not in A
// or has a difference value from A
const isEmpty = require('lodash/isEmpty')
const isObject = require('./is-object')

function objectDiff(A, B) {
  // if types differ, or are "scalars" (including arrays), ignore it
  if (!isObject(A) || !isObject(B)) return B

  return Object.keys(B).reduce((result, fieldB) => {
    if (isObject(B[fieldB])) {
      const subResult = objectDiff(A[fieldB], B[fieldB])
      if (!isEmpty(subResult)) result[fieldB] = subResult
    } else {
      // it's a "scalar", so compare B's field as-is.
      // For "object-like" stuff like arrays, it will still be "different".
      if (A[fieldB] !== B[fieldB]) result[fieldB] = B[fieldB]
    }

    return result
  }, {})
}

module.exports = objectDiff
