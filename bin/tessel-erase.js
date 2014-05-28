#!/usr/bin/env node
var tessel_dfu = require('../dfu/tessel-dfu')
  , fs = require('fs')
  , path = require('path')
  ;

var common = require('../src/cli')
var erasePath = path.join(__dirname, "tessel-erase.bin");

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel logs')
  .option('force', {
    abbr: 'f',
    flag: true,
    help: 'Forces an erase binary onto Tessel. This will erase all user code even if user code is locking up.'
  })
  .parse();

if (argv.force) {
  tessel_dfu.runRam(fs.readFileSync(erasePath), function(){
    console.log('Tessel filesystem erased.');
  });
} else {
  common.controller(true, function (err, client) {
    client.erase(function () {
      console.log('Attempting to erase Tessel filesystem.');
      console.log("If erasing failed try running \"tessel erase --force\"");
      client.close();
    }); 
  });
}
