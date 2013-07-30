#!/usr/bin/env node

var fs = require('fs')
  , spawn = require('child_process').spawn
  , path = require('path')
  , repl = require('repl');

var choices = require('choices')
  , colors = require('colors')
  , jssc = require('jssc');


if (process.argv.length < 3) {
  console.error('ScriptStick CLI\nUsage: ss [-i] [filename]');
  process.exit(1);
}

function compile (file, safe, next) {
  var bufs = [];
  var colony = spawn('colony', ['-cb', path.relative(process.cwd(), file)]);
  colony.stderr.pipe(process.stderr);
  colony.stdout.on('data', function (data) {
    bufs.push(data);
  })
  colony.on('close', function (code) {
    if (code > 0) {
      if (!safe) {
        // console.error('Invalid JavaScript code (error ', code + '), aborting.');
        process.on('exit', function() {
          process.exit(1);
        });
      } else {
        next(null);
      }
    } else {
      var output = Buffer.concat(bufs);
      next(output);
    }
  })
}


var firstNoDevicesFound = false;

console.log('hey its scripstick'.grey);

detectDevice(function (modem) {
  if (process.argv[2] == '-l') {
    modem = '/dev/' + modem;
    process.stdout.write('Connecting to '.grey + modem.green + '... '.grey);
    var serial = jssc.listen(modem);
    serial.stderr.pipe(process.stderr);

    serial.on('error', function (err) {
      // process.exit(1);
    })
    serial.on('close', function (code) {
      console.log('jssc exited with code', code);
      process.exit(1);
    })
    serial.on('data', function (data) {
      process.stdout.write(data);
    })

    serial.write("!!!", function () {
    });
    return;
  }

  handshake(modem, function (serial) {
    if (process.argv[2] == '-h') {
      console.log('[connected]'.grey);

      // console.log('Beat.');
      // setTimeout(function () {
      //   serial.send('B', '', function () {
      //     console.log('BREAK');
      //   })
      // }, 5000);
    } else if (process.argv[2] == '-i') {
      console.log('[connected]'.grey);

      repl.start({
        prompt: "",
        input: process.stdin,
        output: process.stdout,
        ignoreUndefined: true,
        eval: function eval(cmd, context, filename, callback) {
          cmd = cmd.replace(/^.|\n.$/g, '');
          runeval(cmd, function () {
            callback(null, undefined);
          });
        }
      }).on('exit', function (code) {
        process.exit(code);
      })

      // process.stdin.on('data', function (data) {

      function runeval (data, next) {
        fs.writeFileSync(path.join(__dirname, 'tmp', 'repl.js'), data);
        compile(path.join(__dirname, 'tmp', 'repl.js'), true, function (luacode) {
          if (luacode) {
            upload(serial, luacode);
            next();
          } else {
            process.stdout.write('> ');
            next();
          }
        });
      }

      serial.once('data', function () {
        console.log('global.board = require(\'tm\')');
        runeval('global.board = require(\'tm\')', function () { });
      })

    } else {
      compile(process.argv[2], false, function (luacode) {
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
  // var shake = '';
  // serial.on('data', function onhandshake (data) {
  //   shake += String(data);
  //   if (shake == '!\n') {
  //     serial.removeListener('data', onhandshake);
      serial.on('data', function (data) {
        process.stdout.write(String(data).yellow);
      });
      serial.on('error', function (err) {
        console.error(err);
      });
  //     serial.write("!\n", function () {
        console.log('done.');
        next(serial);
  //     });
  //   } else if (shake.length > 2) {
  //     console.error('ERROR'.red, 'Please restart device.');
  //     process.exit(1);
  //   }
  // })
}

function upload (serial, luacode) {
  var sizebuf = new Buffer(4);
  sizebuf.writeInt32LE(luacode.length, 0);
  serial.write(Buffer.concat([sizebuf, luacode]), function () {
    // console.log(String('[it is written]').grey);
  });
}