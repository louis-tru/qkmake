#!/usr/bin/env node

import util from 'qktool';
import fs = require('qktool/fs');
import Build from './build';
import Export from './export';
import server from './server';
import * as argument from 'qktool/arguments';

const args = process.argv.slice(2);
const cmd = args.shift();
const opts = argument.options;
const help_info = argument.helpInfo;
const def_opts = argument.defOpts;
const cwd = process.cwd();
const host_os = process.platform == 'darwin' ? 'mac': process.platform;

function tryClean() {
	if (opts.clean) { // clean
		fs.rm_r_sync(cwd + '/out/all');
		fs.rm_r_sync(cwd + '/out/small');
	}
}

def_opts(['help','h'], 0,     '--help,-h      Print help info');
def_opts(['port','p'], 1026,  '--port=PORT,-p PORT Run quark debugger server port [{0}]');
def_opts(['clean','c'], 0,    '--clean,-c     First clean build directory [{0}]');

if (opts.help) {
	console.log('Usage: qkmake Command [OS] [Option]');
	console.log('Command:');
	console.log('  init           Initialize the project in an empty directory');
	console.log('  build          Install dependencies and Build transform all of TS files and generate the PKGZ file');
	console.log('  export  [OS]');
	console.log('                 Export project files for the target system');
	console.log('  install        Install dependencies');
	console.log('  start   [OS]');
	console.log('                 Start the web debugging service and monitor file changes,');
	console.log('                 And export project files if use os param');
	console.log('OS:');
	console.log('  Only OS for the "ios" "android" "mac" and "linux"');
	console.log('Options:');
	console.log('  ' + help_info.join('\n  '));
	console.log('Examples:');
	console.log('  qkmake init');
	console.log('  qkmake build  -c');
	console.log('  qkmake export ios');
	console.log('  qkmake start  ios');
}
else if ( cmd == 'export' ) {
	tryClean();
	new Export(cwd, args[0] || host_os).export().catch(e=>console.error(e));
}
else if ( cmd == 'build') {
	tryClean();
	new Build(cwd, cwd + '/out').build().catch(e=>console.error(e));
} else if (cmd == 'init') {
	new Build(cwd, cwd + '/out').init();
}
else if (cmd == 'install') {
	new Build(cwd, cwd + '/out').install_deps();
}
else if (cmd == 'start') {
	tryClean();
	if (['ios', 'android', 'mac', 'linux'].indexOf(args[0]) != -1) {
		new Export(cwd, args[0]).export().catch(e=>console.error(e));
	}
	server(argument.options); // run wrb server
}

export default {};