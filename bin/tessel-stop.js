#!/usr/bin/env node

var common = require('../src/common')

// Setup cli.
common.basic();

common.controller(function (err, client) {
  client.stop(function () {
    console.log('tessel runtime stopped.');
      client.close();
    });
})
