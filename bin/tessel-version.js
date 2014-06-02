#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var common = require('../src/cli')

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel version')
  .option('board', {
    abbr: 'b',
    flag: true,
    help: '[Tessel] Get the version information of the connected Tessel board.',
  })
  .option('help', {
    abbr: 'h',
    help: 'Show usage for tessel version'
  })
  .parse();

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

if (argv.board){
  common.controller(true, function (err, client) {
    client.wifiVer(function(err, wifiVer){
      console.log("Serial #:", client.serialNumber);
      console.log("Wifi Version:", wifiVer);
      console.log("Firmware Version:", client.version.firmware_git);
      console.log("Runtime Version:", client.version.runtime_git);
      client.close(function () {
        process.exit(0);
      });
    });
  });
} else {
  try {
    console.log(require('../package.json').version.replace(/^v?/, 'v'))
  } catch (e) {
    console.error('version unknown');
  }
}

