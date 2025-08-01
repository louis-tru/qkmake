#!/usr/bin/env node

import fs = require('qktool/fs');
import Build from './build';
import Export from './export';
import {start} from './server';
import * as argument from 'qktool/arguments';
import {spawn,exec} from 'qktool/syscall';
import path from 'qktool/path';
import { getLocalNetworkHost } from 'qktool/network_host';

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
		fs.rm_r_sync(cwd + '/out/tsbuildinfo');
	}
}

def_opts(['help','h'], 0,     '--help,-h      Print help info');
def_opts(['port','p'], 1026,  '--port=PORT,-p PORT Run quark debugger server port [{0}]');
def_opts(['clean','c'], 0,    '--clean,-c     First clean build directory [{0}]');
def_opts(['debug','d'], '127.0.0.1:9229',
															'--debug,-d     Debug address and prot [{0}]');
def_opts(['brk','b'],   0,    '--brk,-b       Startup as debugger break [{0}]');

if (opts.help) {
	console.log('Usage: qkmake Command [OS] [Option]');
	console.log('Command:');
	console.log('  init    [examples]');
	console.log('                  Initialize the project in an empty directory');
	console.log('  build           Install dependencies and Build transform all of TS files and generate the PKGZ file');
	console.log('  export  [OS]    Export project files for the target system');
	console.log('  open    [OS]    Open only the exported project if no exported yet then there will exec export CMD');
	console.log('  install         Install dependencies');
	console.log('  start   [web]   Startup and run Quark ui program and forward all of params to Quark');
	console.log('  watch           Start the web debugging service and watching file changes');
	console.log('OS:');
	console.log('  Only OS for the "ios" "android" "mac" and "linux"');
	console.log('Options:');
	console.log('  ' + help_info.join('\n  '));
	console.log('Examples:');
	console.log('  qkmake init');
	console.log('  qkmake build  -c');
	console.log('  qkmake export ios');
	console.log('  qkmake open   ios');
	console.log('  qkmake start  .');
	console.log('  qkmake watch');
}
else if (cmd == 'export') {
	tryClean();
	new Export(cwd, args[0] || host_os).export().catch(e=>console.error(e));
}
else if (cmd == 'build') {
	tryClean();
	new Build(cwd, cwd + '/out').build().catch(e=>console.error(e));
}
else if (cmd == 'init') {
	new Build(cwd, cwd + '/out').init(args[0]);
}
else if (cmd == 'install') {
	new Build(cwd, cwd + '/out').install_deps(args);
}
else if (cmd == 'open') {
	tryClean();
	new Export(cwd, args[0]).export(true);
}
else if (cmd == 'start') {
	(async function() {
		const arg0 = args[0] || '';
		const all = `${path.cwd()}/out/all`;
		if (arg0 == 'web') {
			args[0] = `http://${(getLocalNetworkHost()[0] || '127.0.0.1')}:1026`;
		}
		else if (arg0) {
			if (arg0[0] == '-') {
				args.unshift(all);
			} else {
				if (path.resolve(arg0) == path.cwd()) {
					args[0] = all;
				}
			}
		} else {
			args.unshift(all);
		}
		if (args[0] == all) {
			if (!fs.existsSync(`${cwd}/out/all/package.json`) ) {
				await new Build(cwd, cwd + '/out').build();
			}
		}
		console.log(`Start running...`);
		console.log(`quark`, ...args);
		await spawn('quark', [...args], {
			onData:()=>'',
			onError:()=>'',
			stdout: process.stdout,
			stderr: process.stderr, stdin: process.stdin,
		});
	})();
}
else if (cmd == 'watch' || !cmd) {
	(async function() {
		tryClean();
		if (!fs.existsSync(`${cwd}/out/all/package.json`) ) {
			await new Build(cwd, cwd + '/out').build();
		}
		// run web server
		await start(cwd, {server: { port: argument.options.port, root: `${cwd}` }});
	})();
}

export default {};