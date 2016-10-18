var fs = require('fs');
var LC = require('./cloc.js');
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
        "max-statements": [2, 15],
        "max-depth": [1, 5],
        "complexity": [2, 5],
        "max-len": [2, 65],
        "max-params": [2, 3],
        "max-nested-callbacks": [2, 2],
        "smells/no-complex-switch-case": 1,
        "smells/no-this-assign": 1,
        // "smells/no-complex-string-concat": 1,
        "smells/no-complex-chaining": 1,
        "no-reassign/no-reassign": 1,
        "no-extra-bind": 1,
        "no-cond-assign": 2
    },
    "plugins": [
        "smells",
        "no-reassign"
    ]
}
function getCommits(cb) {
    exec('git log | cat - > ../c-ommits', {
        cwd: 'uut/'
    }, function(error, stdout, stderr) {
        console.log(stderr);
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
        cb(commits.reverse());
    });
}

// getCommits(function (data) {
//     console.log(data);
// });

var cli = new CLIEngine(cnf);
var output = {};
var fmap = {};
getCommits(function (commits) {
    var N = commits.length;
    var I = 0;
    exec('git reset --hard && git checkout ' + commits[0].id, {
        cwd: 'uut/'
    }, function (err, stdout, stderr) {

        commits.forEachAsync(function (c, next) {
            // if (c.id != 'a58e3deac27fca9ddbb7e389fdfe7be3aebea639') return next();
            // console.error('!>> git diff-tree --no-commit-id --numstat -M -r ' + c.id + ' -z');
            exec('git diff-tree --no-commit-id --numstat -M -r -z ' + c.id, {
                cwd: 'uut/'
            }, function (error, stdout, stderr) {
                var files = stdout.split('\u0000').map(function (e) {return e.split(/\t/);});
                files.pop();
                fmap = {};
                for (var i=0;i<files.length;i++) {
                    var e = files[i];
                    if (e[2] == '') {
                        e[2] = files[i+2][0];
                        i+=2;
                    }
                    fmap[e[2]]= [~~e[0], ~~e[1]];
                }
                // console.error('>>> git diff-tree --no-commit-id --name-status -M -r ' + c.id);
                exec('git diff-tree --no-commit-id --name-status -M -r -z ' + c.id, {
                    cwd: 'uut/'
                }, function (error, stdout, stderr) {
                    console.log('COMMIT ' + c.id);
                    if (error) throw error;
                    // var files = stdout.split("\n").map(function (e) {return e.split(/\t/);});
                    var _files = stdout.split('\u0000').map(function (e) {return e.split(/\t/);});
                    _files.pop();
                    var files = [];
                    for (var i=0;i<_files.length;i++) {
                        if (_files[i][0][0] == 'R') {
                            files.push([_files[i][0], _files[i+1][0], _files[i+2][0]]);  
                            i+=2;  
                        }else {
                            files.push([_files[i][0], _files[i+1][0]]);
                            i+=1;
                        }
                            
                    }
                    exec('git reset --hard && git checkout ' + c.id, {
                        cwd: 'uut/'
                    }, function (error, stdout, stderr) {
                        var target = [];
                        var changes = [];
                        files.forEach(function (e) {
                            var f = e[1];
                            
                            // console.log("files : ", f, DIFF_CHANGES[e[0][0]]);
                            var push = null;
                            if (DIFF_CHANGES[e[0][0]] == 'deleted') {
                                changes.push({f: f, type: 'deleted'});
                                console.log(">>> uut/" + f + '\t' + fmap[f][0] + '\t' + fmap[f][1] + '\t' + fmap[f][1]);
                            }
                            if (DIFF_CHANGES[e[0][0]] == 'modified') {
                                changes.push({f: f, type: 'modified'});
                                push = f;
                            }
                            if (DIFF_CHANGES[e[0][0]] == 'renamed') {
                                var  fnew = e[2];
                                changes.push({f: f, type: 'renamed', to: fnew});
                                push = fnew;
                            }
                            if (DIFF_CHANGES[e[0][0]] == 'added') {
                                changes.push({f: f, type: 'added'});
                                push = f;
                            }
                            if (push !== null && !fs.existsSync('uut/'+push)) push = null;
                            if (push != null && !fmap[push]) {
                                throw push;
                            }
                            if (push !== null) {
                                target.push("uut/"+push);
                            }
                        });
                        LC(target, function (lines) {
                            target.forEach(function (f) {
                                var abs = f.substr(4);
                                console.log(">>> " + f + '\t' + fmap[abs][0] + '\t' + fmap[abs][1] + '\t' + lines[f]);
                                var report = cli.executeOnFiles([f]);
                            })
                            console.error(N + " -- " + (++I));
                            next();
                        })
                    });
                });
            });
        }, function () {
            // fs.writeFileSync('./data.json', JSON.stringify(output));
        });
    });
});
// lint myfile.js and all files in lib/
// var report = cli.executeOnFiles(["uut/"]);

// console.log(JSON.stringify(report, null, 4));

