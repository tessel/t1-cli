// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var lua = process.binding('lua');

process.on('message', function (data) {
	var ret = null;
	try {
		ret = lua.loadstring(data)()
		console.log(ret);
	} catch (e) {
		console.error(e);
	}
	process.send({ready: true, ret: ret});
})

process.send({ready: true, ret: null});

setInterval(function () { }, 1000);