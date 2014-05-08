#!/usr/bin/env node

var common = require('../src/cli')

// Setup cli.
common.basic();

common.controller(true, function (err, client) {
    console.log('tessel runtime stopped.');
    client.close();
})
