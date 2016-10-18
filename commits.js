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
var DIFF_CHANGES = {
    'A': 'added',
    'C': 'copied',
    'D': 'deleted',
    'M': 'modified',
    'R': 'renamed',
    'T': 'changed',
    'U': 'unmerged',
    'X': 'unknown',
    'B': 'broken'
};
// var binfo = JSON.parse(fs.readFileSync('./buginfo.json').toString());
var CLIEngine = require("eslint").CLIEngine;
var cnf = {
    "env": {
        "node": 1
    },
    "useEslintrc": false,
    "rules": {
        // "max-statements": [2, 15],
        // "max-depth": [1, 5],
        // "complexity": [2, 5],
        // "max-len": [2, 65],
        // "max-params": [2, 3],
        // "max-nested-callbacks": [2, 2],
        // "smells/no-complex-switch-case": 1,
        // "smells/no-this-assign": 1,
        // "smells/no-complex-string-concat": 1,
        // "smells/no-complex-chaining": 1,
        // "no-reassign/no-reassign": 1,
        // "no-extra-bind": 1,
        "no-cond-assign": 2
    },
    "plugins": [
        "smells",
        "no-reassign"
    ]
}
function getCommits(cb) {
    exec('git log | cat - > ../commits', {
        cwd: 'uut/'
    }, function(error, stdout, stderr) {
        console.log(stderr);
        var commits = [];
        stdout = fs.readFileSync('./commits').toString();
        stdout.split(/\n/).forEach(function (line) {
            var cmrex = /^commit ([0-9a-f]{40})$/g;
            var match = cmrex.exec(line);
            var bugs = line.match(/#\d+/g, line);
            if (match == null && bugs != null) {
                commits[commits.length-1].fix = bugs.map(b => b.substr(1));
                return;
            }
            if (match == null && line.startsWith('Date:   ')) {
                commits[commits.length-1].date = line.substr('Date:   '.length);
                return;
            }
            if (match == null) return;
            commits.push({id: match[1], date: -1});
        });
        cb(commits.reverse());
    });
}

// getCommits(function (data) {
//     console.log(data);
// });

var cli = new CLIEngine(cnf);
var output = {};

getCommits(function (commits) {
    var N = commits.length;
    var I = 0;
    exec('git reset --hard && git checkout ' + commits[0].id, {
        cwd: 'uut/'
    }, function (err, stdout, stderr) {

        commits.forEachAsync(function (c, next) {

            exec('git diff-tree --no-commit-id --name-status -M -r ' + c.id, {
                cwd: 'uut/'
            }, function (error, stdout, stderr) {
                // console.log(error);
                // console.log(stdout);
                // console.log(stderr);
                console.log(c.id);
                var files = stdout.split("\n").map(function (e) {return e.split(/\t/);});
                files.pop();
                exec('git reset --hard && git checkout ' + c.id, {
                    cwd: 'uut/'
                }, function (error, stdout, stderr) {
                    var target = [];
                    var changes = [];
                    files.forEach(function (e) {
                        var f = e[1];
                        console.log("files : ", f, DIFF_CHANGES[e[0][0]]);
                        var push = null;
                        if (DIFF_CHANGES[e[0][0]] == 'deleted') {
                            changes.push({f: f, type: 'deleted'});
                        }
                        if (DIFF_CHANGES[e[0][0]] == 'modified') {
                            changes.push({f: f, type: 'modified'});
                            push = f;
                        }
                        if (DIFF_CHANGES[e[0][0]] == 'renamed') {
                            var  fnew = e.slice(2);
                            changes.push({f: f, type: 'renamed', to: fnew});
                            push = fnew;
                        }
                        if (DIFF_CHANGES[e[0][0]] == 'added') {
                            changes.push({f: f, type: 'added'});
                            push = f;
                        }
                        if (push !== null && !fs.existsSync('uut/'+push)) push = null;
                        if (push !== null) {
                            target.push("uut/"+push);
                        }
                    });
                    
                    var report = cli.executeOnFiles(target);
                    output[c.id] = report;
                    output[c.id].fix = c.fix?c.fix:[];
                    output[c.id].changes = changes;
                    output[c.id].date = new Date(c.date);
                    console.error(N + " -- " + (++I));
                    fs.writeFileSync('./commits-data/'+c.id+'.json', JSON.stringify(output[c.id], null, 4));
                    next();
                });
            });
        }, function () {
            fs.writeFileSync('./data.json', JSON.stringify(output));
        });
    });
});
// lint myfile.js and all files in lib/
// var report = cli.executeOnFiles(["uut/"]);

// console.log(JSON.stringify(report, null, 4));

