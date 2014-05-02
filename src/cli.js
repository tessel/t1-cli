var fs = require('fs')
  , path = require('path')
  , temp = require('temp')
  , request = require('request')

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

function controller (next)
{
  header.init();
  tessel.findTessel(null, function (err, client) {
    if (!client || err) {
      console.error('ERR'.red, err);
      return;
    }

    header.connected(client.serialNumber);

    next(null, client);
  });
}

var utils = {
  "buildsPath": "http://builds.tessel.io/",
  "debugPath": "http://debug.tessel.io/"
}

// check the builds list
function checkBuildList (version, next){
  request.get(utils.buildsPath+'builds.json', function(err, data){
    if (err) next && next(null);
    try {
      var builds = JSON.parse(data.body);

      // find the latest
      builds.sort(function(a, b){
        var aBuildDate = a.url.match(/-firmware-(.*?).bin/);
        var bBuildDate = b.url.match(/-firmware-(.*?).bin/);

        if (!aBuildDate) return 1;
        if (!bBuildDate) return -1;

        if (aBuildDate[1] > bBuildDate[1]) return -1;
        if (aBuildDate[1] < bBuildDate[1]) return 1;

        return 0;
      });

      var firmwareDate = new Date(version.date+" "+version.time);
      var newFirmwareDate = new Date(builds[0].modified);
      // in case the builds.version has the full git commithash instead of the first 10 char
      if (newFirmwareDate.valueOf() > firmwareDate.valueOf() && builds[0].version.search(version.firmware_git) == -1){
        // out of date
        return next && next(builds, true);
      } else {
        return next && next(builds, false);
      }
    } catch (e){
      next && next(null, false);
    }
  });
}

function saveBuild(url, next) {
  var d = new Date().toISOString();
  temp.open('firmware-'+d, function (err, info){
    var file = fs.createWriteStream(info.path);
    request.get(utils.buildsPath+url).pipe(file).on('close', function(){
      next && next(info.path);
    });
  });
}

exports.saveBuild = saveBuild;
exports.checkBuildList = checkBuildList;
exports.utils = utils;

exports.basic = basic;
exports.controller = controller;