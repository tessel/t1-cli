var fs = require('fs')
  , path = require('path')

var tessel = require('./')


/**
 * CLI modes
 */

function basic ()
{
  require('colors');
  require('colorsafeconsole')(console);
}

function repeatstr (str, n) {
  return Array(n + 1).join(str);
}

var header = {
  init: function () {
    header._msg('TESSEL? '.grey);
  },
  _unwrite: function (n) {
    process.stderr.write(repeatstr('\b', n));
    header.len = 0;
  },
  _msg: function (str) {
    header._unwrite(header.len || 0);
    header.len = str.stripColors.length;
    process.stderr.write(str);
  },
  nofound: function () {
    header._msg('TESSEL? No Tessel found, waiting...'.grey);
  },
  connected: function (serialNumber) {
    header._msg('TESSEL!'.bold.cyan + ' Connected to '.cyan + ("" + serialNumber).green + '.          \n'.cyan);
  }
}

function controller (stop, next)
{
  header.init();

  if (typeof stop === 'function' && typeof next === 'undefined') {
    next = stop;
    stop = false;
  }

  tessel.findTessel(null, stop, function (err, client) {
    if (!client || err) {
      console.error('ERR'.red, err);
      return;
    }

    header.connected(client.serialNumber);

    next(null, client);
  });
}

exports.basic = basic;
exports.controller = controller;