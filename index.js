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
  , temp = require('temp')
  , read = require('read')
  , keypress = require('keypress');

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
  tesselClient.detectDirectory(file, function (err, pushdir, relpath) {
    if (err) {
      setTimeout(function () {
        console.error('ERR'.red, err.message);
        process.exit(1);
      }, 10)
      return;
    }

    setTimeout(function () {
      console.error(('Bundling directory ' + pushdir).grey);
    }, 100);
    tesselClient.bundleCode(pushdir, relpath, args, function (err, pushdir, tarstream) {
      console.error(('Deploying...').grey);

      client.deployBundle(tarstream, options.save);
    });
  });
}

function pushBinary (file, client) {
  console.error(('Deploying binary ' + file).grey);
  client.deployBinary(file);
}

function dumpBinary(file){

  var gzBuff = fs.readFileSync(file);
  var newGzipBuff = new Buffer(gzBuff.length - 4);
  gzBuff.copy(newGzipBuff, 0, 4, gzBuff.length);

  zlib.inflate(newGzipBuff, function(err, inflated) {
    console.log("dumping binary");

    if (!err) {
      // untar it
      fs.mkdir('dump', function(error) {
        if (!err) {
          fs.writeFileSync("dump/"+file+"-tarred", inflated);
          exec("tar xvf "+file+"-tarred", {
            cwd: process.cwd()+"/dump"
          }, function (err, stdout, stderr){
            if (err) {
              console.log("error couldn't untar", file, stderr);
            } else {
              console.log("dumped ", file);
            }
            // remove tarball
            fs.unlinkSync("dump/"+file+"-tarred");
            process.exit(1);
          });
        } else {
          console.log("can't make dump dir", error);
        }
      });
    } else {
      console.error("can't inflate", file, err);
    }
  });
}

if (process.argv.length < 3) {
  usage();
  process.exit(1);
}

if (argv.v || process.argv[2] == 'version') {
  exec("more VERSION", {
    cwd: __dirname,
  }, function (err, stdout, stderr){
    if (err) {
      console.log(require('./package.json').version.replace(/^v?/, 'v'))
    } else {
      console.log(stdout);
    }
  });
} else if (process.argv[2] == 'dfu-restore') {
  require('child_process').spawn(__dirname + '/dfu/tessel-dfu-restore', process.argv.slice(3), {
    stdio: 'inherit'
  }).on('close', function (code) {
    process.on('exit', function () {
      process.exit(code);
    })
  });
} else if (process.argv[2] == 'list') {
  tesselClient.detectModems(function (err, modems) {
    modems.map(function (modem) {
      console.log(modem);
    });
  })
} else if (process.argv[2] == 'check') {
  dumpBinary(process.argv[3]);
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

  if (process.argv[2] == 'push' || process.argv[2] == 'repl') {
    // Push new code to the device.
    if (process.argv[2] == 'push') {
      if (process.argv.length < 4) {
        usage();
        process.exit(1);
      } 

      var pushpath = process.argv[3];
    } else if (process.argv[2] == 'repl') {
      var pushpath = __dirname + '/repl';
    }

    var argv = [];
    var options = {
      save: false,
      binary: false
    };

    // for all the process args
    for (var i = 2; i<process.argv.length; i++){
      switch(process.argv[i])
      {
      case '-a' || '--args':
        // TODO: only supports 1 argument right now
        argv = process.argv.slice(i+1);
        break;
      case '-s' || '--save':
        options.save = true;
        break;
      case '-b' || '--binary':
        console.log("uploading binary", process.argv.slice(i+1));
        pushBinary(process.argv.slice(i+1)[0], client);
        options.binary = true;
        break;
      default:
        break;
      }
    }

    var updating = false;
    client.on('command', function (command, data) {
      if (command == 'u') {
        console.error(data.grey)
      } else if (command == 'U') {
        if (updating) {
          // Interrupted by other deploy
          process.exit(0);
        }
        updating = true;
      }
    });

    client.once('script-start', function () {
      // Pipe output to client
      client.stdout.pipe(process.stdout);

      // Repl hack
      if (process.argv[2] == 'repl') {
        function cool () {
          // make `process.stdin` begin emitting "keypress" events
          keypress(process.stdin);
          // listen for the ctrl+c event, which seems not to be caught in read loop
          process.stdin.on('keypress', function (ch, key) {
            if (key && key.ctrl && key.name == 'c') {
              process.exit(0);
            }
          });

          read({prompt: '>>'}, function (err, data) {
            try {
              if (err) {
                throw err;
              }
              var script
                // = 'function _locals()\nlocal variables = {}\nlocal idx = 1\nwhile true do\nlocal ln, lv = debug.getlocal(2, idx)\nif ln ~= nil then\n_G[ln] = lv\nelse\nbreak\nend\nidx = 1 + idx\nend\nreturn variables\nend\n'
                = 'local function _run ()\n' + colony.colonize(data, false) + '\nend\nsetfenv(_run, colony.global);\n_run()';
              client.command('M', new Buffer(JSON.stringify(script)));
              client.once('message', function (ret) {
                console.log(ret.ret);
                setImmediate(cool);
              })
            } catch (e) {
              console.error(e.stack);
              setImmediate(cool);
            }
          });
        }
        client.once('message', cool);
      }

      client.once('script-stop', function (code) {
        client.end();
        process.exit(code);
      });
    });

    if (!options.binary) {
      pushCode(pushpath, ['tessel', process.argv[3]].concat(argv), client, options);
    }
  } else if (process.argv[2] == 'stop') {
    // haaaack
    pushCode(path.join(__dirname,'scripts','stop.js'), [], client);

  } else if (process.argv[2] == 'wifi') {
    if (process.argv.length == 3) {
      // just request status
      client.wifiStatus(function (err, data) {
        Object.keys(data).map(function (key) {
          console.log(key.replace(/^./, function (a) { return a.toUpperCase(); }) + ':', data[key]);
        })
        process.exit(0);
      })

    } else {
      if (process.argv.length < 4) {
        usage();
        process.exit(1);
      }

      var ssid = process.argv[3];
      var pass = process.argv[4] || "";
      var security = (process.argv[5] || (pass ? 'wpa2' : 'unsecure')).toLowerCase();

      // Only defer to make print after thing.
      client.once('connect', function () {
        console.log(('Network ' + JSON.stringify(ssid) + 
          ' (pass ' + JSON.stringify(pass) + ') with ' + security + ' security'));
      });

      // This is just for fun logs
      client.on('command', function (command, data) {
        if (command == 'w') {
          console.log(data);
        }
      });

      client.configureWifi(ssid, pass, security, function (err) {
        process.exit(0);
      });
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