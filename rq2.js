var fs = require('fs');
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
modules.forEach(function (mod) {
	RUN(mod);
});
function RUN(mod) {
	console.log(mod);
	var data = JSON.parse(fs.readFileSync('./results/' + mod + '.json').toString());
	var booleans = {'this-assign': 1,'no-reassign': 1,'extra-bind': 1,'cond-assign': 1};
	var filesHistory = {};

	var CC = 0;
	var total = [];
	function go() {
		data.forEach(function (commit, index) {
			commit.changes.forEach(f => {
				filesHistory[f.f] = filesHistory[f.f] || {commits: [], f: f.f};
				commit.date = new Date(commit.date);
				var current = {
					commit: commit,
					metrics: {},
					churn: f.churn
				};
				current.metrics = reducer(f);
				filesHistory[f.f].commits.push(current);
			});
		});
		var dateDiff = function (d1, d2) {
			return Math.round((-d1.getTime()+d2.getTime())/1000/60/60);
		}
		var headers = ['time', 'prevBugs', 'linesAdded', 'linesRemoved', 'totalChurn', 'loc'];
		Object.keys(qs[mod]).forEach(m => headers.push(m));
		Object.keys(booleans).forEach(m => headers.push(m));
		headers.push('smelly');
		headers.push('event');
		total.push(headers);
		for (var f in filesHistory) {
			if (!f.endsWith('.js')) continue;
			if (f.startsWith('test/')) continue;
			print(filesHistory[f]);
		}
		fs.writeFileSync('./results/r2/' + mod + '.csv', total.map(row => row.join(',')).join('\n'));
		function print(f) {
			// console.log('$ '+f.f);
			f.commits.sort(function (a, b) {
				return a.commit.date-b.commit.date;
			});
			var date = f.commits[0].commit.date;
			var counter = 0;
			var last = null;
			f.commits.forEach(c => {
				last = c;
				// if (c.commit.fix.length > 0) {
					counter+=c.commit.fix.length;

					var DATA = [dateDiff(date, c.commit.date), counter, c.churn[0], c.churn[1], c.churn[0] + c.churn[1], c.churn[2]];
					var OR = 0;
					Object.keys(qs[mod]).forEach(m => {
						DATA.push(c.metrics[m]);
						if (c.metrics[m]) OR = 1;
					});
					Object.keys(booleans).forEach(m => {
						DATA.push(c.metrics[m]);
						if (c.metrics[m]) OR = 1;
					});
					DATA.push(OR);
					DATA.push(c.commit.fix.length>0?1:0);
					total.push(DATA);
					if (DATA[0] >= 0 && OR == 1) {
						// console.log(++CC)
					}
					date = c.commit.date;

				// }
			});
			if (last.commit.fix.length > 0) return;
			// console.log([dateDiff(date, last.commit.date), counter, last.metric, 0].join(','));

			// console.log();
		}
		function reducer(f) {
			var mets = {};
			Object.keys(qs[mod]).forEach(met => {
				var th = (qs[mod][met][3]+10*qs[mod][met][4])/11;
				mets[met] = reducerInternal(f, met) >= th?1:0;
			})
			Object.keys(booleans).forEach(met => {
				mets[met] = reducerInternal(f, met) == 1?1:0;
			})
			return mets;
		}
		function reducerInternal(f, met) {
			var smell = met;
			if (!f.smells[smell] && f.type == 'deleted') return 0;
			if (!f.smells[smell]) return 0;
			return f.smells[smell].reduce((a, b) => Math.max(a, b), 0);
		}
	}
	go();
}