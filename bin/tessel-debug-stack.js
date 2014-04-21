#!/usr/bin/env node

var common = require('../src/common')

// Setup cli.
common.basic();

common.controller(function (err, client) {
  console.log('Requesting stack trace from Tessel...'.grey);

  client.debugstack(function(err, stack) {
    if (err) throw err;
    console.log(stack || "Not running");
    client.end();
  })
})
