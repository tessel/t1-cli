// Create a TCP interface directly to a serial port in jssc
// node index.js /dev/tty.usbmodem0000

var net = require('net')
  , jssc = require('jssc')

var modem = process.argv[2];

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

var clients = [], connected = false, backlog = [];
var tesselserver = net.createServer(function (socket) {
  clients.push(socket);
  socket.on('data', function (data) {
    // TODO check that this is all the data
    serial.write(data);
  })
  socket.on('end', function () {
    clients.splice(clients.indexOf(socket), 1);
    if (clients.length == 0) {
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
tesselserver.listen(6540);

// Wait for initial "!\n"
// var shake = '';
// serial.on('data', function onhandshake (data) {
//   shake += String(data);
//   if (shake == '!\n') {
//     serial.removeListener('data', onhandshake);


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
//     serial.write("!\n", function () {

serial.on('connected', function () {
  process.send({ ready: true });
});