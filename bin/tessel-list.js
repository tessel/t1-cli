#!/usr/bin/env node

var tesselClient = require('../')
  , common = require('../src/cli')

// Setup cli.
common.basic();

tesselClient.listDevices(function (err, devices) {
  devices.map(function (device) {
    console.log(device.serialNumber);
  });
})