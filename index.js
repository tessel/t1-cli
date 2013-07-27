#!/usr/bin/env node

var fs = require('fs')
  , spawn = require('child_process').spawn
  , path = require('path');

var choices = require('choices')
  , colors = require('colors')
  , jssc = require('jssc');


if (process.argv.length < 3) {
  console.error('ScriptStick CLI\nUsage: ss [-i] [filename]');
  process.exit(1);
}

function compile (file, next) {
  var bufs = [];
  var colony = spawn('colony', ['-cb', path.relative(process.cwd(), file)])
  colony.stderr.on('data', function (data) {
    console.error(String(data).red);
  })
  colony.stdout.on('data', function (data) {
    bufs.push(data);
  })
  colony.on('close', function (code) {
    if (code > 0) {
      console.error('Invalid colony output code', code + ', aborting.');
      process.exit(1);
    }

    var output = Buffer.concat(bufs);
    next(output);
  })
}


var firstNoDevicesFound = false;

console.log('hey its scripstick'.grey);

detectDevice(function (modem) {
  handshake(modem, function (serial) {
    if (process.argv[2] == '-i') {
      console.log('[connected]'.grey);

      // console.log('Beat.');
      // setTimeout(function () {
      //   serial.send('B', '', function () {
      //     console.log('BREAK');
      //   })
      // }, 5000);
    } else {
      compile(process.argv[2], function (luacode) {
        upload(serial, luacode);
      });
    }
  });
});

function detectDevice (next) {
  var modems = fs.readdirSync('/dev').filter(function (file) {
    return file.match(/^cu.usbmodem.*$/);
  });

  if (modems.length == 0) {
    if (!firstNoDevicesFound) {
      console.error('No ScriptStick connected, waiting for device to connect...'.grey);
      firstNoDevicesFound = true;
    }
    return setTimeout(detectDevice, 10, next);
  }

  if (modems.length > 1) {
    choices('Select a device: ', modems, function (i) {
      next(modems[i]);
    });
  } else {
    next(modems[0]);
  }
}

function handshake (modem, next) {
  modem = '/dev/' + modem;
  process.stdout.write('Connecting to '.grey + modem.green + '... '.grey);

  var serial = jssc.listen(modem);
  serial.stderr.pipe(process.stderr);

  serial.on('close', function (code) {
    console.log('jssc exited with code', code);
    process.exit(1);
  })
  serial.on('cts', function (cts) {
    if (!cts) {
      process.exit(1);
    }
  })

  // Wait for initial "!\n"
  var shake = '';
  serial.on('data', function onhandshake (data) {
    shake += String(data);
    if (shake == '!\n') {
      serial.removeListener('data', onhandshake);
      serial.on('data', function (data) {
        process.stdout.write(data);
      });
      serial.on('error', function (err) {
        console.error(err);
      });
      serial.write("!\n", function () {
        console.log('done.');
        next(serial);
      });
    } else if (shake.length > 2) {
      console.error('ERROR'.red, 'Please restart device.');
      process.exit(1);
    }
  })
}

function upload (serial, luacode) {
  var sizebuf = new Buffer(4);
  sizebuf.writeInt32LE(luacode.length, 0);
  serial.write(Buffer.concat([sizebuf, luacode]), function () {
    console.log(String('[it is written]').grey);
  });
}