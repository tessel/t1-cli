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
  , colors = require('colors')
  , util = require('util')
  , logs = require('../src/logs')
  ;

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel wifi')
  .option('list', {
    abbr: 'l',
    flag: true,
    help: '[Tessel] List available wifi networks.',
  })
  .option('network', {
    abbr: 'n',
    help: '[Tessel] The network to connect to.'
  })
  .option('password', {
    abbr: 'p',
    help: '[Tessel] Password of the network. Omit for unsecured networks.'
  })
  .option('security', {
    abbr: 's',
    default: 'wpa2',
    help: '[Tessel] Security type of the network, one of (wpa2|wpa|wep). Omit for unsecured networks.'
  })
  .option('timeout', {
    abbr: 't',
    default: 20,
    help: '[Tessel] Sets timeout before retrying connection to network.'
  })
  .option('help', {
    abbr: 'h',
    help: '[Tessel] Show usage for tessel wifi'
  })
  .parse();

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

common.controller(false, function (err, client) {
  if (argv.list) {
    client.listen(true, null); // TODO: should use [20, 21, 22, 86] once firmware logs at the right level
    client.wifiStatus(function (err, data) {
      Object.keys(data).map(function (key) {
        if (key.toUpperCase() == "IP"){
          // reverse key.data
          data[key] = data[key].split(".").reverse().join(".");
        }
        logs.info(key.replace(/^./, function (a) { return a.toUpperCase(); }) + ':', data[key]);
      })
      client.close();
    })

  } else {
    if (!argv.network){
      usage();
    }

    function retry () {
      var ssid = argv.network;
      var pass = argv.password || "";
      var security = (argv.security || (pass ? 'wpa2' : 'unsecure')).toLowerCase();

      client.configureWifi(ssid, pass, security, {
        timeout: argv.timeout
      }, function (data) {
        if (data.event == 'error') {
          logs.err('Error in connecting (%d). Please try again.', data.error);
          process.on('exit', function () {
            process.exit(1);
          })
          client.close();
        } else if (!data.connected) {
          logs.err('Could not connect. Check that your network and password are correct.');
          logs.info('Try increasing the timeout with "tessel wifi -n <network> -p <password> -t <timeout (s)>" if the connection is weak.');
          client.close();
        } else {
          logs.info('Connected!\n');

          logs.info('IP\t', data.ip);
          logs.info('DNS\t', data.dns);
          logs.info('DHCP\t', data.dhcp);
          logs.info('Gateway\t', data.gateway);
          client.close();
        }
      });
    }

    // Flush earlier USB network messages.
    // TODO: Actually flush these.
    setTimeout(retry, 2000);
  }
})
