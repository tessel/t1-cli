#!/usr/bin/env node

// tessel-repl
// Thin redirect to tessel-node -i

var spawn = require('child_process').spawn;

spawn(__dirname + '/tessel-run.js', ['-i'], {
  stdio: 'inherit'
})
.on('exit', function (code) {
  process.exit(code);
});