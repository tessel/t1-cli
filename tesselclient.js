var net = require('net');
var carrier = require('carrier');
var portscanner = require('portscanner')
var spawn = require('child_process').spawn;

exports.connect = function (port, host) {
  var tesselclient = net.connect(port, host);

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
        throw new Error('Invalid command body from Tessel: ' + data);
      }
    }

    tesselclient.emit('command', type, data, type == type.toLowerCase());
  });

  // Forward along messages
  tesselclient.on('command', function (type, data) {
    if (type == 'M') {
      tesselclient.emit('message', data);
      console.log('[MESSAGE]'.cyan, JSON.stringify(data));
    }
  })

  tesselclient.command = function (type, buf, next) {
    var sizebuf = new Buffer(5);
    sizebuf.writeUInt8(type.charCodeAt(0), 0);
    sizebuf.writeInt32LE(buf.length, 1);
    client.write(Buffer.concat([sizebuf, buf]), function () {
      next && next();
    });
  };

  return tesselclient;
}

exports.connectServer = function (modem, next) {
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
          next(null);
        }
      });
    } else {
      next(null);
    }
  });
}