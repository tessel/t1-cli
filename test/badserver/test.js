// This test fails if any error is thrown.

var assert = require('assert');
var builds = require('../../src/builds');

console.log('1..5');

assert(builds.utils.buildsPath == 'http://builds.tessel.io/');

// run this first
builds.checkBuildList('current', function (builds) {
	// noop, success if nothing is thrown
	console.log(builds ? 'ok' : 'not ok', '- builds list for "current" must exist.');
});


function checkBogusServer (path) {
	builds.utils.buildsPath = path;
	builds.checkBuildList('2014-05-31', function (builds) {
		// noop, success if nothing is thrown
		console.log('ok');
	});
}

checkBogusServer('http://example.com/');
checkBogusServer('https://example.com/');
checkBogusServer('http://fake.example.com/');
checkBogusServer('https://fake.example.com/');
