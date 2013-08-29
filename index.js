#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , repl = require('repl')
  , colony = require('colony')
  , net = require('net')
  , spawn = require('child_process').spawn;

var choices = require('choices')
  , colors = require('colors')
  , async = require('async')
  , portscanner = require('portscanner')
  , optimist = require('optimist')
  , jssc = require('jssc')
  , dgram = require('dgram')
  , carrier = require('carrier');

var argv = optimist.argv;

function usage () {
  console.error("Tessel CLI\nUsage:\n" +
    "       tessel <filename>\n" +
    "       tessel logs\n" +
    "       tessel push <filename> [-r <ip:port>]\n" +
    // "       tessel pushall <filename>\n"+
    "       tessel wifi <ssid> <pass>\n"+
    "       tessel stop\n");
}

if (process.argv.length < 3) {
  usage();
  process.exit(1);
}

function isPathAbsolute(file) {
  return /^(?:[A-Za-z]:)?\\?\//.test(file);
}

// Compile a filename to code, detect error situation.

function compile (file, safe, next) {
  try {
    var filepath = file;
    if (!isPathAbsolute(filepath)) {
      filepath = path.join(process.cwd(), file);
    }

    colony.bundleFiles(filepath, {
      tessel: __dirname + '/node_modules/tessel-lib',
      events: null,
      net: null,
      dgram: null
    }, function (luacode) {
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

var net = require('net');


// TCP
// if (process.argv[2] == 'remotepush') {
//   if (process.argv.length < 6) {
//     usage();
//     process.exit(1);
//   }

//   var filename = process.argv[3];
//   var ip = process.argv[4];
//   var port = process.argv[5];

//   var net = require('net');
//   var fs = require('fs');

//   compile(filename, false, function (luacode) {
//     console.log('Writing', luacode.length, 'bytes by TCP...');
//     var client = net.connect(port, ip, function () {
//       console.log('connected');
//       var sizebuf = new Buffer(4);
//       sizebuf.writeInt32LE(luacode.length, 0);
//       client.write(Buffer.concat([sizebuf, luacode]), function () {
//         console.log('written');
//         // client.end();
//       });
//     });
//     client.on('end', function () {
//       console.log('disconnected');
//     });
//   });
// } else {
  header.init();

  if (argv.r) {
    var args = argv.r.split(':');
    host = args[0];
    port = args[1];
    onconnect('[remote]', port, host);
  } else {
    detectDevice(function (modem) {
      // Listening.
      // if (process.argv[2] == '-l') {
      handshake(modem, function () {
        onconnect(modem, 6540, 'localhost');
      });
    });
  }

  function pushCode(file, client){
    compile(file, false, function (luacode) {
      upload('U', client, luacode);
    });
  }

  function onconnect (modem, port, host) {
    var tesselclient = net.connect(port, host);
    // tesselclient.pipe(process.stdout);
    tesselclient.on('error', function (err) {
      console.error('Error: Cannot connect to Tessel locally.', err);
    })
    tesselclient.on('connect', function () {
      header.connected(modem.replace(/\s+$/, ''));
    })

    // Parse messages, crudely.
    carrier.carry(tesselclient, function (data) {
      data = String(data);
      var type = 's';
      if (data.match(/^\#\&/)) {
        type = data.charAt(2);
        data = data.substr(3);
      }
      if (type == type.toUpperCase()) {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.error('  error -'.red, 'Invalid message', data);
          return;
        }
      }
      tesselclient.emit('command', type, data, type == type.toLowerCase());
    });

    if (process.argv[2] == 'push') {
      // Push new code to the device.
      if (process.argv.length < 4) {
        usage();
        process.exit(1);
      }

      var updating = 0, scriptrunning = false;
      tesselclient.on('command', function (command, data) {
        if (command == 'u') {
          console.error(data.grey);
        } else if (command == 's' && scriptrunning) {
          console.log(data);
        } else if (command == 'S' && data == '1') {
          scriptrunning = true;
        } else if (command == 'U') {
          if (updating) {
            // Interrupted by other deploy
            process.exit(0);
          }
          updating = true;
        }
      });
      pushCode(process.argv[3], tesselclient);
    } else if (process.argv[2] == 'stop') {
      pushCode(path.dirname(require.main.filename)+'/scripts/stop.js', tesselclient);
    // } else if (process.argv[2] == 'pushall'){
    //   // listen for all possible 
    //   var client = dgram.createSocket('udp4');
    //   var addresses = [];
    //   client.bind(5454, function() {
    //     client.addMembership('224.0.1.187'); // hard coded for now
    //   });
      
    //   console.log(('listening for tessel devices...').yellow);

    //   client.on('listening', function () {
    //       var address = s.address();
    //   });
      
    //   client.on('message', function (message, remote) {   
    //     if (addresses.indexOf(remote.address) == -1) {
    //       addresses.push(remote.address);
    //       console.log("found ip: " + remote.address);
    //     } 
    //     // console.log('B: From: ' + remote.address + ':' + remote.port +' - ' + message);
    //   });

    //   // timeout of 2 seconds
    //   setTimeout(function () {
    //     client.close();
    //     console.log('pushing code to the following: ', addresses);
    //     // push to all gathered ips
    //     addresses.forEach(function(address){
    //       var tClient = net.connect(port, address);
    //       // tClient.on('connect', function () {
    //       //   header.connected(modem);
    //       // });
    //       pushCode(address, tClient);
    //     });
        
    //   }, 2000);

    // } else if (process.argv[2] == 'firmware') {
    //   if (process.argv.length < 4) {
    //     usage();
    //     process.exit(1);
    //   }

    //   upload('F', tesselclient, fs.readFileSync(process.argv[3]));

    } else if (process.argv[2] == 'wifi') {
      var ssid = process.argv[3];
      var pass = process.argv[4];

      if (process.argv.length < 5) {
        usage();
        process.exit(1);
      }

      tesselclient.once('connect', function () {
        console.log(('Network ' + JSON.stringify(ssid) + ' (pass ' + JSON.stringify(pass) + ')'));
      });

      tesselclient.on('command', function (command, data) {
        if (command == 'w') {
          console.log(data);
        } else if (command == 'W' && 'ip' in data) {
          process.exit(0);
        }
      });

      
      var outbuf = new Buffer(96);
      outbuf.fill(0);
      // TODO use byteslength for node 0.8
      new Buffer(ssid).copy(outbuf, 0, 0, ssid.length);
      new Buffer(pass).copy(outbuf, 32, 0, pass.length);

      var sizebuf = new Buffer(5);
      sizebuf.writeUInt8('W'.charCodeAt(0), 0);
      sizebuf.writeInt32LE(outbuf.length, 1);

      tesselclient.write(Buffer.concat([sizebuf, outbuf]), function () {
        // console.log(String('[it is written]').grey);
      });

    } else if (process.argv[2] == 'logs' || process.argv[2] == 'listen') {
      tesselclient.on('command', function (command, data, debug) {
        if (debug) {
          console.log(command.grey, data);
        }
      });

    } else if (process.argv[2] == 'verbose') {
      tesselclient.on('command', function (command, data, debug) {
        console.log(debug ? command.grey : command.red, data);
      });

    } else {
      usage();
      process.exit(1);
    }
  }
  // }

  // Interactive.
  // handshake(modem, function (serial) {
  //   if (process.argv[2] == '-i') {
  //     console.log('[connected]'.grey);

  //     repl.start({
  //       prompt: "",
  //       input: process.stdin,
  //       output: process.stdout,
  //       ignoreUndefined: true,
  //       eval: function eval(cmd, context, filename, callback) {
  //         cmd = cmd.replace(/^.|\n.$/g, '');
  //         runeval(cmd, function () {
  //           callback(null, undefined);
  //         });
  //       }
  //     }).on('exit', function (code) {
  //       process.exit(code);
  //     })

  //     // process.stdin.on('data', function (data) {

  //     function runeval (data, next) {
  //       fs.writeFileSync(path.join(__dirname, 'tmp', 'repl.js'), data);
  //       compile(path.join(__dirname, 'tmp', 'repl.js'), true, function (luacode) {
  //         if (luacode) {
  //           upload(serial, luacode);
  //           next();
  //         } else {
  //           process.stdout.write('> ');
  //           next();
  //         }
  //       });
  //     }

  //     serial.once('data', function () {
  //       console.log('global.board = require(\'tm\')');
  //       runeval('global.board = require(\'tm\')', function () { });
  //     })

  //   } else {
  //     compile(process.argv[2], false, function (luacode) {
  //       upload(serial, luacode);
  //     });
  //   }
  // });
// }

function detectDevice (next) {
  if (process.platform.match(/^win/)) {
    jssc.list(onmodems);
  } else {
    onmodems(null, fs.readdirSync('/dev').filter(function (file) {
      return file.match(/^cu.usbmodem.*$/);
    }).map(function (file) {
      return '/dev/' + file;
    }));
  }

  function onmodems (err, modems) {
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
}

function handshake (modem, next) {
  header.connecting(modem);

  portscanner.checkPortStatus(6540, 'localhost', function (err, status) {
    if (status != 'open') {
      var child = spawn(process.argv[0], [__dirname + '/server.js', modem], {
        stdio: [0, 1, 2, 'ipc'],
        detached: true
      });
      child.on('message', function (m) {
        if (m.ready) {
          // child.unref();
          // child.disconnect();
          next(null);
        }
      });
    } else {
      next(null);
    }
  });
}

function upload (car, client, luacode) {
  var sizebuf = new Buffer(5);
  sizebuf.writeUInt8(car.charCodeAt(0), 0);
  sizebuf.writeInt32LE(luacode.length, 1);
  client.write(Buffer.concat([sizebuf, luacode]), function () {
    // console.log(String('[it is written]').grey);
  });
}