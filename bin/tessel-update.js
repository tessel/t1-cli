#!/usr/bin/env node
var os = require("os"), 
  temp = require('temp'),
  path = require('path'),
  request = require('request'),
  fs = require('fs'),
  colors = require('colors'),
  tessel_dfu = require('../dfu/tessel-dfu')
  ;

var common = require('../src/cli');
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-update')
  .option('script', {
    position: 1,
    full: 'script.js',
    help: 'Update the Tessel firmware',
  })
  .option('url', {
    abbr: 'u',
    help: 'Optional url of firmware version'
  })
  .parse();


function applyBuild(url, client){
  console.log(colors.grey("Downloading firmware from "+url));
  common.saveBuild(url, function(newFirmware) {
    console.log(colors.grey("Updating firmware... please wait. Tessel will reset itself after the update"));
    client.close();
    setTimeout(function(){
      tessel_dfu.write(fs.readFileSync(newFirmware));
    }, 500);
  });
}

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
  } else {
    console.log(colors.grey("Checking for latest firmware... "));
    common.checkBuildList(client.version, function (builds, needUpdate){
      if (!builds) {
        // no builds?
        return console.log(colors.red("No builds were found"));
      }
      if (needUpdate) {
        applyBuild(builds[0].url, client);
      } else {
        // already at latest build
        console.log(colors.green("Tessel is already on the latest firmware build"));
        return client.close();
      }
    });
  }

});