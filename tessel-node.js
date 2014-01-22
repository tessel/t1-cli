#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , repl = require('repl')
  , colony = require('colony')
  , net = require('net')
  , spawn = require('child_process').spawn
  , exec = require('child_process').exec
  , zlib = require('zlib');

var choices = require('choices')
  , colors = require('colors')
  , async = require('async')
  , optimist = require('optimist')
  , dgram = require('dgram')
  , temp = require('temp');

var tesselClient = require('tessel-client');

// Automatically track and cleanup files at exit
temp.track();

var argv = optimist
  .boolean('q').alias('quiet', 'q')
  .argv;

// process.on('uncaughtException', function (err) {
//   console.error(err.stack);
// })

var verbose = !argv.q;

// Push new code to the device.
if (argv._.length < 1) {
  usage();
  process.exit(1);
}

function usage () {
  console.error("Usage: tessel [-q] script.js")
}

function pushCode (file, args, client, options) {
  tesselClient.detectDirectory(file, function (err, pushdir) {
    verbose && console.error(('Bundling directory ' + pushdir).grey);
    tesselClient.bundleCode(pushdir, file, args, function (err, pushdir, tarstream) {
      verbose && console.error(('Deploying...').grey);

      client.deployBundle(tarstream, options.save);
    });
  });
}

if (argv.r) {
  setImmediate(function () {
    console.log('listening...'.grey);
  })
  var args = argv.r.split(':');
  host = args[0];
  port = args[1] || 4444;
  onconnect('[' + host + ':' + port + ']', port, host);
} else {
  var firstNoDevicesFound = false;
  tesselClient.selectModem(function notfound () {
    console.error('Error: No tessel devices detected.');
    process.exit(1);
  }, function found (err, modem) {
    verbose && console.error(('Connecting to ' + modem).grey);
    tesselClient.connectServer(modem, function () {
      onconnect(modem, 6540, 'localhost');
    });
  });
}

function onconnect (modem, port, host) {
  var client = tesselClient.connect(port, host);
  // client.pipe(process.stdout);
  client.on('error', function (err) {
    console.error('Error: Cannot connect to Tessel locally.', err);
  })

  var options = {
    save: false,
    binary: false
  };

  var updating = 0, scriptrunning = false;
  client.on('command', function (command, data) {
    if (command == 'u') {
      verbose && console.error(data.grey);
    } else if (command == 's' && scriptrunning) {
      console.log(data);
    } else if (command == 'S' && data == '1') {
      scriptrunning = true;
    } else if (command == 'S' && scriptrunning && parseInt(data) <= 0) {
      scriptrunning = false;
      client.end();
      process.exit(-parseInt(data));
    } else if (command == 'U') {
      if (updating) {
        // Interrupted by other deploy
        process.exit(0);
      }
      updating = true;
    }
  });

  pushCode(argv._[0], ['tessel', argv._[0]].concat(argv._.slice(1)), client, options);
}
