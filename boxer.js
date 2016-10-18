var fs = require('fs');
var exec = require('child_process').exec;
var modules = ['express', 'less.js', 'request', 'grunt', 'bower'];
// var modules = ['express', 'forever', 'less.js', 'request', 'socket.io', 'grunt', 'bower', 'commander.js', 'debug', 'underscore'];
var smells = ['max-len', 'complex-chaining', 'max-params', 'max-nested-callbacks', 'max-statements', 'complexity', 'max-depth', 'complex-switch-case'];


var total = {};
smells.forEach(function (sm) {
	total[sm] = [];
	var csv = '';
	modules.forEach(mod => {
		var data = JSON.parse(fs.readFileSync('./results/'+mod+'.json').toString());
		var out = [];
		data.forEach(d => {
			d.changes.forEach(c => {
				if (!c.smells[sm]) return;
				c.smells[sm].forEach(n => {
					out.push(n);
				});
			});
		});
		out = out.sort(function (a, b) {
			a = ~~a;
			b = ~~b;
			if (a<b) return -1;
			if (a>b) return +1;
			return 0;
		});
		var iq = (n) => Math.floor(n*(out.length-1)/4);
		total[sm].push({
			mod: mod,
			q: [0,1,2,3,4].map(i => out[iq(i)])
		});
		console.log(sm + ' @ ' + mod + ' - ' + [0,1,2,3,4].map(i => out[iq(i)]).join(', '));

		out.unshift(mod);
		csv += out.join(',')+'\n';
	});
	fs.writeFileSync('./results/agg/'+sm+'.csv', csv);
});
fs.writeFileSync('./results/agg/total.json', JSON.stringify(total, null, 4));

function reducer(f) {
	var smell = 'max-statements';
	if (!f.smells[smell] && f.type == 'deleted') return 0;
	if (!f.smells[smell]) return 0;
	return f.smells[smell].reduce((a, b) => Math.max(a, b), 0);
}