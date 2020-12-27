// account for Objection Models as well, which apparently get taken out by lodash
const get = require('lodash/get')
const isPlainObject = require('lodash/isPlainObject')

module.exports = input => {
  return isPlainObject(input) || typeof get(input, '$knex') === 'function'
}
