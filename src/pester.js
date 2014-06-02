// Ensure a minimum version number for Node.

var colors = require('colors')
  , semver = require('semver')
  ;

if ('node' in process.versions) {
  var expecting = require('../package.json').engines.node;
  if (!semver.satisfies(process.versions.node, expecting)) {
    console.error('%s Expecting Node version %s. You are running %s, please upgrade.', colors.red('ERR'), expecting, process.versions.node);
    process.exit(127);
  }
}
