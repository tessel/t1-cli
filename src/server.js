// Create a TCP interface directly to a serial port
// node index.js /dev/tty.usbmodem0000

var net = require('net')
  , libserialport = require('libserialport')

var modem = process.argv[2];

var serial = libserialport.open(modem);
// serial.stderr.pipe(process.stderr);

serial.on('close', function (code) {
  if (code) {
    console.error('Tessel server terminated with non-zero error code', code);
  }
  process.exit(1);
})
serial.on('cts', function (cts) {
  if (!cts) {
    process.exit(1);
  }
})

var clients = [], connected = false, backlog = [];
var tesselserver = net.createServer(function (socket) {
  clients.push(socket);
  socket.on('error', function () {
    // swallow errors
  });
  socket.on('data', function (data) {
    // TODO check that this is all the data
    serial.write(data);
  })
  socket.on('end', function () {
    clients.splice(clients.indexOf(socket), 1);
    if (clients.length == 0) {
      serial.close();
      process.exit(0);  
    }
  })
  connected = true;
  if (backlog.length) {
    backlog.forEach(function (log) {
      clients.forEach(function (client) {
        client.write(log);
      })
    });
    backlog = [];
  }
});
tesselserver.on('error', function () {
  // swallow errors
});
tesselserver.listen(6540);

serial.on('data', function (data) {
  if (!connected) {
    backlog.push(data);
  } else {
    clients.forEach(function (client) {
      client.write(String(data)); 
    })
  }
});
serial.on('error', function (err) {
  console.error(err);
  process.exit(0);
});

// serial.on('connected', function () {
setImmediate(function () {
  process.send && process.send({ ready: true });
});
// });

process.on('SIGINT', function() {
});