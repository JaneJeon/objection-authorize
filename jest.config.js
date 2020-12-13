process.env.OBJECTION_AUTHORIZE_TEST_MODULE = 1

module.exports = {
  coverageThreshold: {
    global: {
      branches: 80
    }
  },
  errorOnDeprecated: true,
  notify: true,
  testPathIgnorePatterns: ['node_modules', 'tests/templates']
}
