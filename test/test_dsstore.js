var tessel = require('../');

console.log('1..1');
tessel.bundleScript(__dirname + '/dsstore/', [], function (err, tarbundle) {
	console.log('ok');
})