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