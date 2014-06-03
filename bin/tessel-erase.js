#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var tessel_dfu = require('../dfu/tessel-dfu')
  , fs = require('fs')
  , path = require('path')
  , logs = require('../src/logs')
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
    logs.info('Tessel filesystem erased.');
  });
} else {
  common.controller(true, function (err, client) {
    client.erase(function () {
      logs.info('Attempting to erase Tessel filesystem.');
      logs.info("If erasing failed try running \"tessel erase --force\"");
      client.close();
    }); 
  });
}
