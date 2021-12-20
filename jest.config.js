module.exports = {
  coverageThreshold: {
    global: {
      branches: 80
    }
  },
  errorOnDeprecated: true,
  notify: true,
  globalSetup: './tests/utils/setup-db.js',
  globalTeardown: './tests/utils/teardown-db.js',
  setupFilesAfterEnv: [
    './tests/utils/trxify-tests.js',
    './tests/utils/teardown-db.js'
  ]
}
