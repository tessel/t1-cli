var tc = require('./tesselclient');

tc.detectModems(function (err, modems) {
  tc.connectServer(modems[0], function (err, port) {
    var client = tc.connect(port);

    client.on('message', function (message) {
      console.log(message);
    })
  })
});