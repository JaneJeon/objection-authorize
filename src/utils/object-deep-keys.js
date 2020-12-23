// Returns ALL of an object's keys (even nested ones) as an array of dot notation.
// Example:
// objectDeepKeys({}) = []
// objectDeepKeys({a: b: {c: [], d: 0}}) = ['a', 'b', 'b.c', 'b.d']
// From: https://stackoverflow.com/a/55465146

function objectDeepKeys(obj) {
  return Object.keys(obj)
    .filter(key => obj[key] instanceof Object)
    .map(key => objectDeepKeys(obj[key]).map(k => `${key}.${k}`))
    .reduce((x, y) => x.concat(y), Object.keys(obj))
}

module.exports = objectDeepKeys
