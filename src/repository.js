var request = require('request');
var parseString = require('xml2js').parseString;
var colors = require('colors');
function getToolsListing(next) {
  request('https://s3.amazonaws.com/tessel-tools/', { headers: { 'User-Agent': 'tessel' } }, function (err, res, body) {
    if (err) {
      return next(err);
    }
    parseString(body, { explicitArray: true }, function (err, result) {
      if (err) {
        return next(err);
      }
      try {
        var entries = result.ListBucketResult.Contents.map(function (entry) {
            var obj = {};
            for (var key in entry) {
              obj[key.replace(/^./, function (a) {
                return a.toLowerCase();
              })] = entry[key].join('');
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
function firmwareURL(tag) {
  return 'https://s3.amazonaws.com/tessel-tools/firmware/tessel-firmware' + (tag == 'current' ? '' : '-' + tag) + '.bin';
}
exports.getToolsListing = getToolsListing;
exports.firmwareURL = firmwareURL;