#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// tessel-repl
// Thin redirect to tessel-node -i

var spawn = require('child_process').spawn;

spawn(__dirname + '/tessel-run.js', ['-i'], {
  stdio: 'inherit'
})
.on('exit', function (code) {
  process.exit(code);
});