#!/usr/bin/env node

// this script works around:
// https://github.com/isaacs/npm/issues/1727
//
// (and also the fact that an `npm install` crawls even
// when nothing is out of date)

var path = require('path');
var fs = require('fs');
var child_process = require('child_process');

var root = path.dirname(path.dirname(__filename));
process.chdir(root);
var modules = path.join(root, 'node_modules');
var packageInfo = require(path.join(root, 'package.json'));
var deps = packageInfo.dependencies;

if (process.env['NODE_ENV'] != 'production') {
	// merge devDependencies
	for (var k in packageInfo.devDependencies) {
		deps[k] = packageInfo.devDependencies[k];
	}
}

var packageNames = Object.keys(deps);

packageNames = packageNames.filter(function(pkg) {
	var p = path.join(modules, pkg);
	if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) {
		console.log(pkg + ": skipping (symlink)");
		return false;
	}
	return true;
});

var outOfDate = packageNames.map(function(pkg) {
	var requirement = (deps[pkg] == '*' ? '' : deps[pkg]);
	return [pkg, requirement];
}).filter(function(pair) {
	var pkg = pair[0]
	var id = pair.join('@');
	try {
		var installed = require(path.join(modules, pkg, 'package.json'));
		if (installed._from != id) {
			throw new Error(pkg + " out of date. \nRequired: " + id + "\nCurrent: " + installed._from);
		}
		console.log(pkg + ': Up to date');
		return false;
	} catch(e) {
		if(e.message) console.error("Error: " + e.message);
		return true;
	}
});

if (outOfDate.length > 0) {
	var args = outOfDate.map(function(pkg) { return pkg.join('@');});
	console.log("Calling `npm install --production " + args.join(" ") + "`");
	var proc = child_process.spawn('npm', ['install', '--production'].concat(args), {stdio:'inherit'});
	proc.on('exit', function(code) {
		process.exit(code);
	})
}
