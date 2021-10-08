// Given objects A (base) and B (test), returns a new object
// with set difference of B - A;
// i.e. an object with fields of B that are either not in A
// or has a difference value from A
const isEmpty = require('lodash/isEmpty')
const isObject = require('./is-object')
const isDate = require('lodash/isDate')
const keys = require('lodash/keys')

function objectDiff(A, B) {
  // if types differ, or are "scalars" (including arrays), ignore it
  if (!isObject(A) || !isObject(B)) return B

  return keys(B).reduce((result, fieldB) => {
    if (isObject(B[fieldB])) {
      const subResult = objectDiff(A[fieldB], B[fieldB])
      if (!isEmpty(subResult)) result[fieldB] = subResult
    } else if (isDate(A[fieldB]) || isDate(B[fieldB])) {
      // special case handling for date objects/strings, for two reasons:
      // 1. Javascript Dates aren't serializable into JSON, so they often come as strings
      // 2. Even if you DID pass two dates, you can't directly compare them using ==/===
      if (+new Date(A[fieldB]) !== +new Date(B[fieldB]))
        result[fieldB] = B[fieldB]
    } else {
      // it's a "scalar", so compare B's field as-is.
      // For "object-like" stuff like arrays, it will still be "different".
      if (A[fieldB] !== B[fieldB]) result[fieldB] = B[fieldB]
    }

    return result
  }, {})
}

module.exports = objectDiff
