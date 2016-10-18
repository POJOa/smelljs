var fs = require('fs-extra');
var exec = require('child_process').exec;
Array.prototype.forEachAsync = function (cb, end) {
	var _this = this;
	setTimeout(function () {
		var index = 0;
		var next = function () {
			if (this.burned) return;
			this.burned = true;
			index++;
			if (index >= _this.length) {
				if (end) end();
				return;
			}
			cb(_this[index], next.bind({}));
		}
		if (_this.length == 0) {
			if (end) end();
		}else {
			cb(_this[0], next.bind({}));
		}
	}, 0);
}

var qs = JSON.parse(fs.readFileSync('./qs.json').toString());
var modules = Object.keys(qs);
if (process.argv[2]) {
	modules = [process.argv[2]];
}
modules.forEachAsync(function (mod, next) {
	console.log("> " + mod);
	fs.copySync('./results/r2/'+mod+'.csv', './data3.csv');

	exec('rscript analyze.r', {
	    cwd: './'
	}, function (err, stdout, stderr) {
		console.log(stdout);
		if (err) throw err;
		if (stderr) console.error(stderr);
		fs.copySync('./rplot.jpg', './results/r2/'+mod+'-n.jpg');			
		next();
	});

}, function () {
	console.log("END");
})
