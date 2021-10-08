// Returns ALL of an object's keys (even nested ones) as an array of dot notation.
const isObject = require('./is-object')
const keys = require('lodash/keys')

function objectDeepKeys(obj) {
  if (!isObject(obj)) return []

  return keys(obj)
    .filter(key => isObject(obj[key]))
    .map(key => objectDeepKeys(obj[key]).map(k => `${key}.${k}`))
    .reduce(
      (x, y) => x.concat(y),
      Object.keys(obj).filter(key => !isObject(obj[key]))
    )
}

module.exports = objectDeepKeys
