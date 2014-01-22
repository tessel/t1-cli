var lua = process.binding('lua');

process.on('message', function (data) {
	var ret = null;
	try {
		ret = lua.loadstring(data)();
	} catch (e) {
		console.log(e);
	}
	process.send({ready: true, ret: ret});
})

process.send({ready: true, ret: null});

setInterval(function () { }, 1000);