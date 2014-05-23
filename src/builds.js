var request = require('request')
  , os = require('os')
  , path = require('path')
  , fs = require('fs')
  ;

var utils = {
  "buildsPath": "http://builds.tessel.io/",
  "debugPath": "http://debug.tessel.io/"
}

function saveCache(header, data, next){
  var d = new Date(header["last-modified"]);
  var maxAge = header["cache-control"].split("=")[1];
  d.setDate(d.getDate() + maxAge/60/60/24);
  var cacheFolder = path.join(os.tmpDir(), "tessel");
  var cachePath = path.join(cacheFolder, 'builds-'+d.valueOf()+"-"+header['etag'].substring(1, header['etag'].length-1)+"-list.json");
  
  fs.mkdir(cacheFolder, function(err){
    fs.writeFile(cachePath, data, function(err){
      next(err, cachePath);
    });
  });
}

function checkCache(current, next){
  // check if we have that temp file
  var tempPath = path.join(os.tmpDir(), "tessel");
  fs.exists(tempPath, function(exists){
    if (!exists) return next(false);

    fs.readdir(tempPath, function(err, files){
      var filtered = files.filter(function(file){
        return file.split("-")[2] == current['etag'].substring(1, current['etag'].length-1);
      });

      if (filtered.length < 1) return next(false);

      // otherwise return the 1 cached file we have
      return next(path.join(os.tmpDir(), "tessel", filtered[0]));
    });
  });
}

function sortBuilds(data){
  var builds = JSON.parse(data);

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

  return builds;
}

// check the builds list
function checkBuildList (version, next){

  function isExpired(builds){
    var firmwareDate = new Date(version.date+" "+version.time);
    var newFirmwareDate = new Date(builds[0].modified);
    // in case the builds.version has the full git commithash instead of the first 10 char
    if (newFirmwareDate.valueOf() > firmwareDate.valueOf() && builds[0].version.search(version.firmware_git) == -1){
      // out of date
      return next && next(builds, true);
    } else {
      return next && next(builds, false);
    }
  }

  request.head(utils.buildsPath+'builds.json', function(err, res){
    if (!err && res){
      checkCache(res.headers, function(cachePath){
        if (cachePath) {
          // use the cached fs
          isExpired(sortBuilds(fs.readFileSync(cachePath)));

        } else {
          request.get(utils.buildsPath+'builds.json', function(err, data){
            if (err) next && next(null);
            saveCache(res.headers, data.body, function(){
              isExpired(sortBuilds(data.body));
            });
          });
        }
      });
    } else {
      next && next(null);
    }
  });
  
}


function getBuild(url, next) {
  request.get({url: url, encoding:null}, function(err, res, body){
    next(err, body);
  });
}

function isValid(buff){
  // check if buff is a valid firmware build
  return buff.readUInt32LE(28) == 0x5A5A5A5A;
}

exports.getBuild = getBuild;
exports.checkBuildList = checkBuildList;
exports.utils = utils;
exports.isValid = isValid;
