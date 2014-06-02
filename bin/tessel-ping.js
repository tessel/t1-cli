#!/usr/bin/env node
var tessel_dfu = require('../dfu/tessel-dfu')
  , fs = require('fs')
  , path = require('path')
  ;

var common = require('../src/cli');

// Setup cli.
common.basic();

common.controller(true, function (err, client) {
  (function loop () {
    console.error('ping...');
    client.ping(function pong (data) {
      console.log(data);
      setTimeout(loop, 1000);
    });
  })();
});
