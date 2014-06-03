// This test fails if any error is thrown.

var async = require('async');
var assert = require('assert');
var builds = require('../../src/builds');

console.log('1..5');

assert(builds.utils.buildsPath == 'https://builds.tessel.io/');

function checkBogusServer (path) {
	return function (next) {
		builds.utils.buildsPath = path;
		builds.checkBuildList('2014-05-31', function (builds) {
			// noop, success if nothing is thrown
			console.log('ok');
			next();
		});
	}
}

// run this first
async.series([
	function (next) {
		builds.checkBuildList('current', function (builds) {
			// noop, success if nothing is thrown
			console.log(builds ? 'ok' : 'not ok', '- builds list for "current" must exist.');
			next();
		});
	},
	checkBogusServer('http://example.com/'),
	checkBogusServer('https://example.com/'),
	checkBogusServer('http://fake.example.com/'),
	checkBogusServer('https://fake.example.com/'),
]);
