var net = require('net');
var carrier = require('carrier');
var portscanner = require('portscanner')
var spawn = require('child_process').spawn;
var fs = require('fs');

var tesselClient = exports;

tesselClient.connect = function (port, host) {
  var client = net.connect(port, host);

  // Parse messages, crudely.
  carrier.carry(client, function (data) {
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
        throw new Error('Invalid command body from Tessel: ' + data);
      }
    }

    client.emit('command', type, data, type == type.toLowerCase());
  });

  // Forward along messages
  client.on('command', function (type, data) {
    if (type == 'M') {
      client.emit('message', data);
    }
  })

  client.command = function (type, buf, next) {
    var sizebuf = new Buffer(5);
    sizebuf.writeUInt8(type.charCodeAt(0), 0);
    sizebuf.writeInt32LE(buf.length, 1);
    this.write(Buffer.concat([sizebuf, buf]), function () {
      next && next();
    });
  };
  
  return client;
}

tesselClient.connectServer = function (modem, next) {
  portscanner.checkPortStatus(6540, 'localhost', function (err, status) {
    if (status != 'open') {
      var child = spawn(process.argv[0], [__dirname + '/server.js', modem], {
        stdio: [0, 1, 2, 'ipc'],
        //detached: true
      });
      child.on('error', function (err) {
        next(err);
      })
      child.on('message', function (m) {
        if (m.ready) {
          // child.unref();
          // child.disconnect();
          next(null, 6540);
        }
      });
    } else {
      next(null, 6540);
    }
  });
}

tesselClient.detectModems = function (next) {
  if (process.platform.match(/^win/)) {
    jssc.list(next);
  } else {
    next(null, fs.readdirSync('/dev').filter(function (file) {
      return file.match(/^(cu.usbmodem.*|ttyACM.*)$/);
    }).map(function (file) {
      return '/dev/' + file;
    }));
  }
}

tesselClient.selectModem = function detectDevice (notfound, next) {
  tesselClient.detectModems(function (err, modems) {
    if (modems.length == 0) {
      notfound();
      return setTimeout(detectDevice, 10, notfound, next);
    }

    if (modems.length > 1) {
      choices('Select a device: ', modems, function (i) {
        next(null, modems[i]);
      });
    } else {
      next(null, modems[0]);
    }
  });
}

tesselClient.acquire = function (next) {
  tesselClient.selectModem(function (err, modem) {
    tesselClient.connectServer(modem, function (err, port) {
      next(err, tesselClient.connect(port));
    });
  })
}