var tesselClient = require('../tessel-client');

tesselClient.acquire(function (err, client) {
  client.on('message', function (message) {
    console.log(message);
  })
});