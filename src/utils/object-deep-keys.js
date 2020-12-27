// Returns ALL of an object's keys (even nested ones) as an array of dot notation.
const isPlainObject = require('lodash/isPlainObject')

function objectDeepKeys(obj) {
  if (!isPlainObject(obj)) return []

  return Object.keys(obj)
    .filter(key => isPlainObject(obj[key]))
    .map(key => objectDeepKeys(obj[key]).map(k => `${key}.${k}`))
    .reduce(
      (x, y) => x.concat(y),
      Object.keys(obj).filter(key => !isPlainObject(obj[key]))
    )
}

module.exports = objectDeepKeys
