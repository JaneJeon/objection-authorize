module.exports = {
  client: 'pg',
  connection: {
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER
  },
  useNullAsDefault: true,
  asyncStackTraces: true,
  migrations: {
    directory: 'tests/migrations'
  },
  seeds: {
    directory: 'tests/seeds'
  }
}
