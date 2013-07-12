#!/usr/bin/env node

var fs = require('fs')
  , spawn = require('child_process').spawn
  , path = require('path');

var choices = require('choices')
  , colors = require('colors')
  , shellescape = require('shell-escape');


if (process.argv.length < 2) {
  console.error('Usage: ss [filename]');
  process.exit(1);
}

var val = fs.readFileSync(process.argv[2], 'utf-8');
val = new Buffer(val);


console.log('hey its scripstick'.grey);

var firstNoDevicesFound = false;
detectDevice();

function detectDevice () {
  var modems = fs.readdirSync('/dev').filter(function (file) {
    return file.match(/^cu.usbmodem.*$/);
  });

  if (modems.length == 0) {
    if (!firstNoDevicesFound) {
      console.error('No ScriptStick connected, waiting for device to connect...');
      firstNoDevicesFound = true;
    }
    return setTimeout(detectDevice, 10);
  }

  if (modems.length > 1) {
    choices('Select a device: ', modems, function (i) {
      onmodemselect(modems[i]);
    });
  } else {
    onmodemselect(modems[0]);
  }
}

var nbi = 1;
function newbuf (l) {
  for (var a = [], i = 0; i < l; i++) {
    a.push(nbi++);
  }
  return new Buffer(a);
}

function onmodemselect (modem) {
  modem = '/dev/' + modem;
  console.log('Connecting to terminal device', modem.green);

  var serial = spawn('python', ['-u', path.join(__dirname, 'pycli.py'), modem]);
  serial.stderr.pipe(process.stderr);

  serial.stdout.once('data', function onhandshake (data) {
    serial.stdout.on('data', function onhandshakeack (data) {
      if (String(data).indexOf('!') > -1) {
        serial.stdout.removeListener('data', onhandshakeack);
        onready();
      }
    });
    serial.stdin.write('!\n');
  })

  serial.on('exit', function () {
    console.error('Serial closed.');
    process.exit(1);
  })

  function onready () {
    console.log('Connected.\n');

    serial.stdout.on('data', function(data) {
      process.stdout.write(String(data).yellow);
    });  

    var sizebuf = new Buffer(4);
    sizebuf.writeInt32LE(val.length, 0);
    serial.stdin.write(Buffer.concat([sizebuf, val]), function () {
      console.log(String('[it is written]').grey);
    });
  }

}