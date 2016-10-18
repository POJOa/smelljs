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
function getCommits() {
    var commits = [];
    stdout = fs.readFileSync('./commits').toString();
    stdout.split(/\n/).forEach(function (line) {
        var cmrex = /^commit ([0-9a-f]{40})$/g;
        var match = cmrex.exec(line);
        if (match == null && line.toLowerCase().indexOf("fix") != -1) {
            commits[commits.length-1].fix = true;
            return;
        }
        if (match == null) return;
        commits.push({id: match[1]});
    });
    return(commits.reverse());
}
var current = {
	files: {}
};
var output = [];
var I = 0;
getCommits().forEach(function (c) {
	var r = JSON.parse(fs.readFileSync('commits-data/'+c.id+'.json').toString());
	console.log((I++))
	current.commit = c.id;
	current.fix = r.fix;
	current.changes = r.changes;
	current.date = r.date;
	console.log(c.id);
	r.results.forEach(function (f) {
		if (f.filePath.lastIndexOf(".js")+3 != f.filePath.length) return;
		if (!f.messages) return;
		f.filePath = f.filePath.substr(4);
		if (f.filePath.indexOf("examples/") == 0) return;
		current.files[f.filePath] = {};
		f.messages.forEach(function (m) {
			if (!m.ruleId) return;
			// console.log("here " + m);
			current.files[f.filePath][m.ruleId] = current.files[f.filePath][m.ruleId] || 0;
			current.files[f.filePath][m.ruleId]++;
		});
		if (Object.keys(current.files[f.filePath]).length == 0) {
			delete current.files[f.filePath];
		}
	});

	r.changes.forEach(function (ch) {
		if (ch.type == 'renamed') {
			ch.to = ch.to[0];
			delete current[ch.f];
		}
		if (ch.type == 'deleted') {
			delete current[ch.f];
		}
	});
	fs.writeFileSync('commits-clean/'+c.id+".json", JSON.stringify(current, null, 4));
});