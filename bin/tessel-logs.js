#!/usr/bin/env node

var common = require('../src/cli')

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel logs')
  .option('all', {
    abbr: 'a',
    flag: true,
    help: 'listens to all messages from tessel (even ones thrown from firmware)'
  })
  .parse();

common.controller(false, function (err, client) {
  if (argv.all){
    client.listen(true);
  } else {
    client.listen(true, [10, 11, 12, 13, 20, 21, 22]);
  }
})
