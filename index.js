#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , repl = require('repl')
  , colony = require('colony')
  , net = require('net')
  , spawn = require('child_process').spawn
  , zlib = require('zlib');

var choices = require('choices')
  , colors = require('colors')
  , async = require('async')
  , optimist = require('optimist')
  , jssc = require('jssc')
  , dgram = require('dgram')
  , temp = require('temp')
  , fstream = require('fstream')
  , tar = require('tar');

var wrench = require('./wrench')
  , tesselClient = require('./tessel-client');


// Automatically track and cleanup files at exit
temp.track();

var argv = optimist.argv;

process.on('uncaughtException', function (err) {
  console.error(err);
})


function usage () {
  console.error("Tessel CLI\nUsage:\n" +
    "   tessel <filename>\n" +
    "   tessel logs\n" +
    "   tessel push <filename> [-r <ip[:port>]]\n" +
    // "       tessel pushall <filename>\n"+
    "   tessel wifi <ssid> <pass> <security (wep/wap/wap2, wap2 by default)>\n"+
    "   tessel wifi <ssid>\n" +
    "          connects to a wifi network without a password\n" + 
    "   tessel wifi\n" +
    "          see current wifi status\n" + 
    "   tessel stop\n" +
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

function tarCode (file, args, client, next) {
  if (!fs.existsSync(file)) {
    setTimeout(function () {
      console.error('ERROR'.red, 'File doesn\'t exist:', file);
      process.exit(1);
    }, 10)
    return;
  }
  if (fs.lstatSync(file).isDirectory()) {
    file = path.join(file, 'index.js');
  }
  if (!fs.existsSync(file)) {
    setTimeout(function () {
      console.error('ERROR'.red, 'File doesn\'t exist or isn\'t a source file:', file);
      process.exit(1);
    }, 10)
    return;
  }
  
  // console.log("making directory");
  temp.mkdir('colony', function (err, dirpath) {
    var pushdir = path.join(process.cwd(), path.dirname(file));

    // Find node_modules dir
    var pushdirbkp = pushdir;
    var relpath = '';
    while (path.dirname(pushdir) != '/' && !fs.existsSync(path.join(pushdir, 'node_modules'))) {
      relpath = path.join(path.basename(pushdir), relpath);
      pushdir = path.dirname(pushdir);
    }
    if (path.dirname(pushdir) == '/') {
      pushdir = pushdirbkp;
      relpath = '';
    }

    wrench.copyDirSyncRecursive(pushdir, path.join(dirpath, 'app'), {
      forceDelete: false,
      exclude: /^\./,
      inflateSymlinks: true
    });

    var stub
      = 'process.env.DEPLOY_IP = ' + JSON.stringify(require('my-local-ip')()) + ';\n'
      + 'process.argv = ' + JSON.stringify(args) + ';\n'
      + 'process.send = function (a) { console.log("#&M" + JSON.stringify(a)); };\n'
      + 'require(' + JSON.stringify('./app/' + path.join(relpath, path.basename(file))) + ');';
    fs.writeFileSync(path.join(dirpath, 'index.js'), stub);

    var docompile = [];

    wrench.readdirRecursive(path.join(dirpath), function (err, curFiles) {
      // console.log(curFiles);
      if (!curFiles) {
        afterColonizing();
        return;
      }
      curFiles.forEach(function (f) {
        // console.log("current file", f);
        if (f.match(/\.js$/)) {
          try {
            var res = colony.colonize(fs.readFileSync(path.join(dirpath, f), 'utf-8'));
            fs.writeFileSync(path.join(dirpath, f), res);
            docompile.push(path.join(dirpath, f));
          } catch (e) {
            e.filename = f.substr(4);
            console.log('Syntax error in', f, ':\n', e);
            process.exit(1);
          }
        }
      })
    });

    var compileBytecode = true;

    function afterColonizing () {
      // compile with compile_lua
      async.each(docompile, function (f, next) {
        if (!compileBytecode) {
          next(null);
        } else {
          colony.toBytecode(fs.readFileSync(f, 'utf-8'), function (err, res) {
            !err && fs.writeFileSync(f, res);
            next(err);
          });
        }

      }, function (err) {
        var bufs = [];
        var fstr = fstream.Reader({path: dirpath, type: "Directory"})
        fstr.basename = '';

        fstr.on('entry', function (e) {
          e.root = {path: e.path};
        })

        fstr
          .pipe(tar.Pack())
          .on('data', function (buf) {
            bufs.push(buf);
          }).on('end', function () {
            var luacode = Buffer.concat(bufs);
            next(null, pushdir, luacode);
          });
      });
    }
  });
}

function pushCode (file, args, client) {
  tarCode(file, args, client, function (err, pushdir, bundle) {
    console.error(('Deploying directory ' + pushdir).grey);
    
    zlib.deflate(bundle, function(err, gzipbuf) {

      if (!err) {
        var sizebuf = new Buffer(4);
        sizebuf.writeUInt32LE(bundle.length, 0);
      
        // fs.writeFileSync("builtin.tar.gz", Buffer.concat([sizebuf, gzipbuf]));
        // console.log("wrote builtin.tar.gz");
      
        client.command('U', Buffer.concat([sizebuf, gzipbuf]));

      } else {
        console.error(err);
      }
    });
  });
}

if (process.argv.length < 3) {
  usage();
  process.exit(1);
}

if (process.argv[2] == 'dfu-restore') {
  require('child_process').spawn(__dirname + '/dfu/tessel-dfu-restore', process.argv.slice(3), {
    stdio: 'inherit'
  });
} else {
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
}

function onconnect (modem, port, host) {
  var client = tesselClient.connect(port, host);
  // client.pipe(process.stdout);
  client.on('error', function (err) {
    console.error('Error: Cannot connect to Tessel locally.', err);
  })
  client.on('connect', function () {
    header.connected(modem.replace(/\s+$/, ''));
  })

  if (process.argv[2] == 'push') {
    // Push new code to the device.
    if (process.argv.length < 4) {
      usage();
      process.exit(1);
    }

    var argv = [];
    if (process.argv[4] == '-a' || process.argv[4] == '--args') {
      argv = process.argv.slice(5);
    }

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
        // process.exit(parseInt(data))
        client.end();
      } else if (command == 'U') {
        if (updating) {
          // Interrupted by other deploy
          process.exit(0);
        }
        updating = true;
      }
    });
    pushCode(process.argv[3], ['tessel', process.argv[3]].concat(argv), client);

  } else if (process.argv[2] == 'stop') {
    // haaaack
    pushCode(path.join(__dirname,'scripts','stop.js'), [], client);

  } else if (process.argv[2] == 'wifi') {
    var ssid = process.argv[3];
    var pass = process.argv[4] || "";
    var security = (process.argv[5] || "wpa2").toLowerCase();

    if (process.argv.length == 3) {
      // just request status

      client.command('V', new Buffer([0xde, 0xad, 0xbe, 0xef]), function () {
        console.error('Requesting wifi status...'.grey);
      });

      client.on('command', function (command, data) {
        if (command == 'V') {
          Object.keys(data).map(function (key) {
            console.log(key.replace(/^./, function (a) { return a.toUpperCase(); }) + ':', data[key]);
          })
          process.exit(0);
        }
      });

    } else {
      if (pass == ""){
        security = "unsecure";
      }
      if (process.argv.length < 4) {
        usage();
        process.exit(1);
      }

      client.once('connect', function () {
        console.log(('Network ' + JSON.stringify(ssid) + 
          ' (pass ' + JSON.stringify(pass) + ') with ' + security + ' security'));
      });

      client.on('command', function (command, data) {
        if (command == 'w') {
          console.log(data);
        } else if (command == 'W' && 'ip' in data) {
          process.exit(0);
        }
      });

      // Package Wifi arguments
      var outbuf = new Buffer(128);
      outbuf.fill(0);
      new Buffer(ssid).copy(outbuf, 0, 0, ssid.length);
      new Buffer(pass).copy(outbuf, 32, 0, pass.length);
      new Buffer(security).copy(outbuf, 96, 0, security.length);

      client.command('W', outbuf);
    }

  } else if (process.argv[2] == 'logs' || process.argv[2] == 'listen') {
    client.on('command', function (command, data, debug) {
      if (debug) {
        console.log(command.grey, data);
      }
    });

  } else if (process.argv[2] == 'verbose') {
    client.on('command', function (command, data, debug) {
      console.log(debug ? command.grey : command.red, data);
    });

  } else {
    usage();
    process.exit(1);
  }
}


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

//   upload('F', client, fs.readFileSync(process.argv[3]));

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