process.env.JEST_JUNIT_OUTPUT_DIR = 'reports/jest'

module.exports = {
  coverageThreshold: {
    global: {
      branches: 80
    }
  },
  coveragePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/tests/'],
  reporters: ['default', 'jest-junit'],
  errorOnDeprecated: true,
  notify: true,
  globalSetup: './tests/utils/setup-db.js',
  globalTeardown: './tests/utils/teardown-db.js',
  setupFilesAfterEnv: [
    './tests/utils/trxify-tests.js',
    './tests/utils/teardown-db.js'
  ]
}
