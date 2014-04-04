#!/usr/bin/env node

var common = require('../src/common')
common.basic();

common.controller(function (err, client) {
  client.listen(true);
})
