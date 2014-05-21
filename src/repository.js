var request = require('request');  
var parseString = require('xml2js').parseString;
var colors = require('colors');

var baseURL = 'https://s3.amazonaws.com/builds.tessel.io/'

function getToolsListing (next) {
  request(baseURL, {
    headers: {
      'User-Agent': 'tessel'
    }
  }, function (err, res, body) {
    if (err) {
      return next(err);
    }

    parseString(body, {
      explicitArray: true,
    }, function (err, result) {
        if (err) {
          return next(err);
        }

        try {
          var entries = result.ListBucketResult.Contents.map(function (entry) {
            var obj = {};
            for (var key in entry) {
              obj[key.replace(/^./, function (a) { return a.toLowerCase(); })] = entry[key].join('');
            }
            return obj;
          });

          next(null, entries);
        } catch (e) {
          return next(err);
        }
    });
  });
}

function firmwareURL (tag) {
  return baseURL + 'firmware/tessel-firmware-' + tag + '.bin';
}

exports.getToolsListing = getToolsListing;
exports.firmwareURL = firmwareURL;
