#!/usr/bin/env node

var fs = require('fs')
  , exec = require('child_process').exec;

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
  console.log('Connected to terminal device', modem.green);

  // var stdout = fs.createWriteStream(modem);
  // stdout.write(new Buffer(0x5E));
  // console.log('done');

  var SerialPort = require("serialport").SerialPort
  var serialPort = new SerialPort(modem, {
    baudrate: 115200
  }, false).on('open', function () {
    process.stdout.write('Opened socket... ');
    serialPort.once('data', function (data) {
      serialPort.write(new Buffer([0xDE]), function(err, results) {
        console.log('starting.');
        serialPort.on('data', function waitforbang (data) {
          if (String(data) == '!\n') {
            serialPort.removeListener('data', waitforbang);
            onready();
          }
        });
      });
    });
  });

  serialPort.open();

  function onready () {
    serialPort.on('data', function(data) {
      process.stdout.write(String(data).yellow);
    });  

    var sizebuf = new Buffer(4);
    sizebuf.writeInt32LE(val.length, 0);
    serialPort.write(Buffer.concat([sizebuf, val]), function(err, results) {
      console.log(String('[write err ' + err + ', written ' + results + ']').grey);
    });
  }

  // while (1) {
  //   try {
  //     var stdin = fs.createReadStream(modem);
  //      var stdout = fs.createWriteStream(modem);

  //     stdin.pipe(process.stdout);
  //     // process.stdin.resume();

  //     stdin.on('data', function (line) {
  //       if (String(line) == 'WAIT\n') {
  //         var val = 'console:log(2 + 2)';
  //         // exec(echoescape(['printf', new Buffer([0, 0, 0, 5])]) + ' > ' + modem);
  //         // exec(echoescape(['printf', val]) + ' > ' + modem);
  //         // fs.writeFileSync(modem, new Buffer([0, 0, 0, eval.length]));
  //         stdout.write(new Buffer(0x5E));
  //         console.log('done');
  //       }
  //     })

  //     return;
  //   } catch (e) {
  //     console.error(e);
  //   }
  // }
}