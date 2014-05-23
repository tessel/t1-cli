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
  .option('wifi', {
    abbr: 'w',
    help: 'Optional version of the TI wifi patch to apply'
  })
  .option('build', {
    abbr: 'b',
    help: 'Optional build of the firmware version (does not update wifi)'
  })
  .option('force',{
    abbr: 'f',
    flag: true,
    help: 'forces the firmware build to update'
  })
  .option('dfu', {
    abbr: 'd',
    flag: true,
    help: 'does firmware updates only to devices in dfu mode'
  })
  .parse();

function usage(){
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

function restore(buff, client, next){
  function delayNext(){
    // hack. otherwise device.__destroy can't be called (device isn't reacquired yet?)

    setTimeout(function(){
      next && next();
    }, 1500);
  }

  // check to make sure buffer is valid
  if (!builds.isValid(buff)){
    console.log(colors.red("Error, firmware is not valid"));
    return next && next(err)
  }

  console.log(colors.grey("Updating firmware... please wait. Tessel will reset itself after the update"));
  client && client.close();

  if (client){
    client.on('close', function(){
      delayNext();
    })
  } else {
    delayNext();
  }
}

function restoreBuild(buff, client, next){
  restore(buff, client, function(){
    tessel_dfu.write(buff, next);
  });
}

function restoreRam(buff, client, next){
  restore(buff, client, function(){
    tessel_dfu.runRam(buff, function(){
      console.log(colors.grey("Wifi patch uploaded... waiting for it to apply (10s)"));
  
      var holdUp = setInterval(function(){
        console.log(colors.grey("..."));
      }, 2000);

      setTimeout(function(){
        clearInterval(holdUp);
        console.log(colors.grey("... Done"));
      }, 12500);
    });
  });
}

function applyBuild(url, client, next){
  console.log(colors.grey("Downloading firmware from "+url));
  builds.getBuild(url, function(err, buff){
    if (!err){
      restoreBuild(buff, client, next);
    } else {
      throw err;
    }
  });
}

function applyRam(url, client, next){
  console.log(colors.grey("Downloading wifi patch from "+url));
  builds.getBuild(url, function(err, buff){
    if (!err){
      restoreRam(buff, client);
    } else {
      throw err;
    }
  });
}

function isLocalPath (str) {
  return str.match(/^[\.\/\\]/);
}

function isUrl (str){
  return str.match(/^(ftp|http|https):\/\//);
}

function update(client, wifiVer){
  if (process.argv.length == 2 || argv.force || argv.dfu){
    // if there's only 2 args apply latest firmware patch
    console.log(colors.grey("Checking for latest firmware... "));
    builds.checkBuildList(client == null ? null : client.version, function (allBuilds, needUpdate){
      if (!allBuilds) {
        // no builds?
        console.log(colors.red("No builds were found"));
        return client && client.close();
      }
      if (needUpdate || argv.force) {
        
        // check if we need a wifi update
        var wifiUpdate = function (){};
        if ( (argv.dfu && argv.wifi) || // if its in dfu mode and a wifi flag is passed, do both updates
          (allBuilds[0].wifi && Number(wifiVer) < Number(allBuilds[0].wifi)) ){ // otherwise only update if version is outdated
         
          console.log(colors.grey("Wifi version is also outdated, applying wifi patch after firmware."));

          wifiUpdate = function(){
            // wait for reboot and reacquire tessel
            setTimeout(function(){
              applyRam(builds.utils.buildsPath+"wifi/"+allBuilds[0].wifi+".bin", null);
            }, 2000);
            
          }
        }

        applyBuild(builds.utils.buildsPath+allBuilds[0].url, client, wifiUpdate);
        
      } else {
        // already at latest build
        console.log(colors.green("Tessel is already on the latest firmware build"));
        return client && client.close();
      }
    });
  } else {
    var updateVer = process.argv[2];

    // check if we have a url
    if (isUrl(updateVer)) {
      // if it's a custom url
      applyBuild(updateVer, client);
    } else if (isLocalPath(updateVer)){
      // if it's a local path just send this file
      restoreBuild(fs.readFileSync(updateVer), client);
    } else if (argv.build){ 
      // rebuild url and download by build number
      applyBuild(builds.utils.buildsPath+"firmware/tessel-firmware-"+argv.build+".bin", client);
    } else if (argv.wifi) {
      // apply the wifi build
      applyRam(builds.utils.buildsPath+"wifi/"+argv.wifi+".bin", client);
    }
  }
}

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
  // check for dfu mode
  var device = tessel_dfu.findDevice();
  if (tessel_dfu.guessDeviceState(device) == 'dfu'){
    if (!argv.dfu) {
      console.log('Err: Tessel is already in DFU mode, run "tessel update --dfu"'.red);
      process.exit(1);
    }

    // otherwise they've run it in dfu mode
    console.log("updating");
    update(null, 0);
  } else {
    common.controller(function (err, client) {

      if (!err) {
        client.listen(true);

        client.on('error', function (err) {
          if (err.code == 'ENOENT') {
            console.error('Error: Cannot connect to Tessel locally.')
          } else {
            console.error(err);
          }
        });

        client.wifiVer(function(err, wifiVer){
          update(client, wifiVer);
        });
      } 
      
    });
  }
}

