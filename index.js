#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , repl = require('repl')
  , colony = require('colony')
  , net = require('net');

var choices = require('choices')
  , colors = require('colors')
  , jssc = require('jssc')
  , async = require('async');


function usage () {
  console.error('Tessel CLI\nUsage: tessel <filename>\n       tessel -[lhi]\n       tessel -t <ip> <port> <filename>');
}

if (process.argv.length < 3) {
  usage();
  process.exit(1);
}

// Compile a filename to code, detect error situation.

function compile (file, safe, next) {
  try {
    colony.bundleFiles(path.join(process.cwd(), file), function (luacode) {
      next(new Buffer(luacode));
    });
  } catch (e) {
    if (!safe) {
      // console.error('Invalid JavaScript code (error ', code + '), aborting.');
      console.error(e);
      process.on('exit', function() {
        process.exit(1);
      });
    } else {
      next(null);
    }
  }
}

function repeatstr (str, n) {
  return Array(n + 1).join(str);
}

var header = {
  init: function () {
    header.len = 0;
    process.stdout.write('TESSEL? '.grey);
  },
  _unwrite: function (n) {
    process.stdout.write(repeatstr('\b', n));
    header.len = 0;
  },
  _msg: function (str) {
    header._unwrite(header.len);
    header.len = str.stripColors.length;
    process.stdout.write(str);
  },
  nofound: function () {
    header._msg('No Tessel found, waiting...'.grey);
  },
  connecting: function (modem) {
    header._msg('Connecting to '.grey + modem.green + '...');
  },
  connected: function (modem, next) {
    var l = header.len + 'TESSEL? '.length;
    header._unwrite(l);
    var out = 'TESSEL!'.bold.cyan + ' Connected to '.cyan + modem.green + '.   \n'.cyan;
    async.eachSeries(out.split(''), function (piece, next) {
      process.stdout.write(piece);
      setImmediate(next);
    }, next);
  }
}


// TCP
if (process.argv[2] == '-t') {
  if (process.argv.length < 6) {
    usage();
    process.exit(1);
  }

  var ip = process.argv[3];
  var port = process.argv[4];
  var filename = process.argv[5];

  var net = require('net');
  var fs = require('fs');

  compile(filename, false, function (luacode) {
    console.log('Writing', luacode.length, 'bytes by TCP...');
    var client = net.connect(port, ip, function () {
      console.log('connected');
      var sizebuf = new Buffer(4);
      sizebuf.writeInt32LE(luacode.length, 0);
      client.write(Buffer.concat([sizebuf, luacode]), function () {
        console.log('written');
        // client.end();
      });
    });
    client.on('end', function () {
      console.log('disconnected');
    });
  });
} else {
  header.init();

  detectDevice(function (modem) {

    // Listening.
    if (process.argv[2] == '-l') {
      modem = '/dev/' + modem;
      header.connecting(modem);
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
      });
      return;
    }

    // Interactive.
    handshake(modem, function (serial) {
      if (process.argv[2] == '-i') {
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
}

function detectDevice (next) {
  var modems = fs.readdirSync('/dev').filter(function (file) {
    return file.match(/^cu.usbmodem.*$/);
  });

  if (modems.length == 0) {
    if (!detectDevice.firstNoDevicesFound) {
      header.nofound();
      detectDevice.firstNoDevicesFound = true;
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
  header.connecting(modem);

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

      var logs = [], connected = false;
      serial.on('data', function (data) {
        if (connected) {
          process.stdout.write(String(data)); 
        } else {
          logs.push(String(data));
        }
      });
      serial.on('error', function (err) {
        console.error(err);
      });
  //     serial.write("!\n", function () {

      serial.on('connected', function () {
        header.connected(modem, function () {
          // logs.forEach(process.stdout.write.bind(process.stdout));
          logs.forEach(function (l) { process.stdout.write(l); })
          connected = true;
          next(serial);
        });
      });
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