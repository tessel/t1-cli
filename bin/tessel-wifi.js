#!/usr/bin/env node

var common = require('../src/cli')
  , colors = require('colors')
  , util = require('util')
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
  client.listen(true, null); // TODO: should use [20, 21, 22, 86] once firmware logs at the right level
  if (argv.list) {
    client.wifiStatus(function (err, data) {
      Object.keys(data).map(function (key) {
        if (key.toUpperCase() == "IP"){
          // reverse key.data
          data[key] = data[key].split(".").reverse().join(".");
        }
        console.log(key.replace(/^./, function (a) { return a.toUpperCase(); }) + ':', data[key]);
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
        timeout: argv.timeout || 8
      }, function (data) {
        if (!data.connected && !argv['no-retry']) {
          console.error('Retrying...');
          setImmediate(retry);
        } else {
          console.log(colors.grey(util.format('Connected to network %s (pw: %s) with %s security', ssid, pass, security)));
          client.close();
        }
      });
    }

    retry();
  }
})
