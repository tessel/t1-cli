// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

var tessel = require('tessel');

var led1 = tessel.led[0].output().high();
var led2 = tessel.led[1].output().low();

var i = 0;
setInterval(function () {
  console.log('Blinked', i++, 'times');
  led1.toggle();
  led2.toggle();
}, 100);