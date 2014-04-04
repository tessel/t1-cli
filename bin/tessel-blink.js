#!/usr/bin/env node

// tessel-blink
// Thin redirect to tessel-push ../scripts/blink

var spawn = require('child_process').spawn;

spawn(__dirname + '/tessel-push.js', ['push', __dirname+'/../scripts/blink'], {
  stdio: 'inherit'
})
.on('exit', function (code) {
  process.exit(code);
});