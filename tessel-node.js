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
  .boolean('v')
  .argv;

// process.on('uncaughtException', function (err) {
//   console.error(err.stack);
// })

function usage () {
  console.error("Tessel CLI\nUsage:\n" +
    "   tessel <filename>\n" +
    "   tessel list\n" +
    "   tessel logs\n" +
    "   tessel push <filename> [-r <ip[:port>]] [-s] [-b <file>] [-c] [-a [options]]\n" +
    "          -r wireless pushing of code (inactive at the moment)\n" + 
    "          -s saves the file that is getting passed to Tessel as builtin.tar.gz\n" + 
    "          -b pushes a binary\n" + 
    "          -a passes arguments to tessel scripts\n" + 
    // "       tessel pushall <filename>\n"+
    "   tessel wifi <ssid> <pass> <security (wep/wap/wap2, wap2 by default)>\n"+
    "   tessel wifi <ssid>\n" +
    "          connects to a wifi network without a password\n" + 
    "   tessel wifi\n" +
    "          see current wifi status\n" + 
    "   tessel stop\n" +
    "   tessel check <file>\n" + 
    "          dumps the tessel binary code\n" + 
    "   tessel dfu-restore <firmware.bin>\n" +
    "          upload new firmware when in DFU mode\n");
}

function repeatstr (str, n) {
  return Array(n + 1).join(str);
}

var header = {
  init: function () {
    header._msg('TESSEL? '.grey);
  },
  _unwrite: function (n) {
    process.stderr.write(repeatstr('\b', n));
    header.len = 0;
  },
  _msg: function (str) {
    header._unwrite(header.len || 0);
    header.len = str.stripColors.length;
    process.stderr.write(str);
  },
  nofound: function () {
    header._msg('TESSEL? No Tessel found, waiting...'.grey);
  },
  connecting: function (modem) {
    header._msg('TESSEL? Connecting to '.grey + modem.grey + '...');
  },
  connected: function (modem) {
    header._msg('TESSEL!'.bold.cyan + ' Connected to '.cyan + modem.green + '.          \n'.cyan);
  }
}

function pushCode (file, args, client, options) {
  tesselClient.detectDirectory(file, function (err, pushdir) {
    setTimeout(function () {
      console.error(('Bundling directory ' + pushdir).grey);
    }, 100);
    tesselClient.bundleCode(pushdir, file, args, function (err, pushdir, tarstream) {
      console.error(('Deploying...').grey);

      client.deployBundle(tarstream, options.save);
    });
  });
}

header.init();

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
    if (!firstNoDevicesFound) {
      header.nofound();
      firstNoDevicesFound = true;
    }
  }, function found (err, modem) {
    header.connecting(modem);
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
  header.connected(modem.replace(/\s+$/, ''));

  // Push new code to the device.
  if (process.argv.length < 3) {
    usage();
    process.exit(1);
  }

  var argv = process.argv.slice(3);
  var options = {
    save: false,
    binary: false
  };

  var updating = 0, scriptrunning = false;
  client.on('command', function (command, data) {
    if (command == 'u') {

      console.error(data.grey);
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

  if (!options.binary) {
    pushCode(process.argv[2], ['tessel', process.argv[2]].concat(argv), client, options);
  }
}
