// https://www.bengladwell.com/run-tests-as-db-transactions-with-objection-js/
const knex = require('./knex')
const BaseModel = require('../models/base')

let afterDone

// Initiate transaction
beforeEach(function (done) {
  knex
    .transaction(function (newtrx) {
      BaseModel.knex(newtrx)
      done()
    })
    .catch(function () {
      // call afterEach's done
      afterDone()
    })
})

// Rollback transaction
afterEach(function (done) {
  afterDone = done
  BaseModel.knex().rollback()
})
