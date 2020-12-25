module.exports = {
  coverageThreshold: {
    global: {
      branches: 80
    }
  },
  errorOnDeprecated: true,
  notify: true,
  globalSetup: './tests/utils/setup-db.js',
  globalTeardown: './tests/utils/teardown-db.js'
}
