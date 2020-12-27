// Returns ALL of an object's keys (even nested ones) as an array of dot notation.
const isPlainObject = require('lodash/isPlainObject')
const get = require('lodash/get')

// account for Objection Models as well, which apparently get taken out by lodash
const isObject = input => {
  return isPlainObject(input) || typeof get(input, '$knex') === 'function'
}

function objectDeepKeys(obj) {
  if (!isObject(obj)) return []

  return Object.keys(obj)
    .filter(key => isObject(obj[key]))
    .map(key => objectDeepKeys(obj[key]).map(k => `${key}.${k}`))
    .reduce(
      (x, y) => x.concat(y),
      Object.keys(obj).filter(key => !isObject(obj[key]))
    )
}

module.exports = objectDeepKeys
