var fs = require('fs');
var totals = JSON.parse(fs.readFileSync('./results/agg/total.json').toString());
var mods = {};
for (m in totals) {
	totals[m].forEach((mod) => {
		mods[mod.mod] = mods[mod.mod] || {};
		mods[mod.mod][m] = mod.q;
	});
}
console.log(JSON.stringify(mods, null, 4));