#!/usr/bin/env node
var common = require('../src/cli');
// Setup cli.
common.basic();
common.controller(function (err, client) {
  client.erase(function () {
    console.log('Tessel filesystem erased.');
    client.close();
  });
});