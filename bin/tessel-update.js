#!/usr/bin/env node
var os = require("os"), 
  temp = require('temp'),
  path = require('path'),
  request = require('request'),
  fs = require('fs'),
  colors = require('colors'),
  tessel_dfu = require('../dfu/tessel-dfu'),
  builds = require('../src/builds')
  ;

var common = require('../src/cli');
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-update')
  .option('list', {
    abbr: 'l',
    flag: true
  })
  .option('url', {
    abbr: 'u',
    list: true,
    help: 'Optional url of firmware version'
  })
  .option('build', {
    abbr: 'b',
    list: true,
    help: 'Optional build of the firmware version'
  })
  .parse();


function applyBuild(url, client){
  console.log(colors.grey("Downloading firmware from "+url));
  builds.getBuild(builds.utils.buildsPath+url, function(err, buff){
    if (!err){
      console.log(colors.grey("Updating firmware... please wait. Tessel will reset itself after the update"));
      client.close();
      setTimeout(function(){
        tessel_dfu.write(buff);
      }, 500);
    } else {
      throw err;
    }
  });
}

// // check if we want to list
if (argv.list){
  // list possible builds
  builds.checkBuildList("", function(allBuilds){
    function currentize (key, i) {
      var date = key.match(/\d{4}-\d{2}-\d{2}/) || 'current   '.yellow;
      return date
    }

    console.log("Switch to any of these builds with `tessel update -b <build name>`");
    var tags = allBuilds.filter(function (file) {
      return file.url.match(/^firmware\/./) && file.url.match(/\.bin$/);
    }).sort(function (a, b) {
      if (a.url < b.url) return 1;
      if (a.url > b.url) return -1;
      return 0;
    }).map(function (file, i) {
      return '  o '.blue + currentize(file.url.replace(/^firmware\//, ''), i);
    });

    if (tags.length > 10) {
      tags = tags.slice(0, 10);
      tags.push('  ...');
    }
    console.log(tags.join('\n'));

  });

} else {
  common.controller(function (err, client) {
    client.listen(true);

    client.on('error', function (err) {
      if (err.code == 'ENOENT') {
        console.error('Error: Cannot connect to Tessel locally.')
      } else {
        console.error(err);
      }
    })

    // check if we have a url
    if (argv.url) {
      applyBuild(argv.url, client);
    }  else if (argv.build){ 
      // rebuild url and download by build number
      applyBuild("firmware/tessel-firmware-"+argv.build[0]+".bin", client);
    } else {
      console.log(colors.grey("Checking for latest firmware... "));
      builds.checkBuildList(client.version, function (allBuilds, needUpdate){
        if (!allBuilds) {
          // no builds?
          console.log(colors.red("No builds were found"));
          return client.close();
        }
        if (needUpdate) {
          applyBuild(allBuilds[0].url, client);
        } else {
          // already at latest build
          console.log(colors.green("Tessel is already on the latest firmware build"));
          return client.close();
        }
      });
    }
  });
}

