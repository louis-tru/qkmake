#!/usr/bin/env node

import util from 'encark';
import fs = require('encark/fs');
import Build from './build';
import Export from './export';
import server from './server';
import * as argument from 'encark/arguments';

const args = process.argv.slice(2);
const cmd = args.shift();
const opts = argument.options;
const help_info = argument.helpInfo;
const def_opts = argument.defOpts;

def_opts(['help','h'], 0,    '--help,-h      Print help info');
def_opts(['port','p'], 1026, '--port=PORT,-p PORT Run quark debugger server port [{0}]');
// def_opts(['remote', 'r'], '', 	'--remote=ADDRESS,-r ADDRESS Remote console address [none]');

const cwd = process.cwd();

if ( opts.help || opts.h) {
	console.log('');
	console.log('Usage: qkmake COMMAND [OS]');
	console.log('Usage: qkmake [OPTION]...');
	console.log('');
	console.log('Examples:');
	console.log('`qkmake init`');
	console.log('`qkmake build`');
	console.log('`qkmake build [-c]`');
	console.log('`qkmake export ios`');
	console.log('`qkmake export android`');
	console.log('`qkmake install`');
	console.log('`qkmake`');
	// console.log('`qkmake -r http://192.168.1.124:1026`');
	console.log('');
	console.log('Defaults for the options are specified in brackets.');
	console.log('');
	console.log('Options:');
	console.log('  ' + help_info.join('\n  '));
	console.log('');
}
else if ( cmd == 'export' ) {
	util.assert(args.length, 'export Bad argument. system name required, for example "qkmake export ios"');
	new Export(cwd, args[0]).export().catch(e=>console.error(e));
}
else if ( cmd == 'build') {
	if ( opts.c ) { // clean
		fs.rm_r_sync(cwd + '/out/install');
		fs.rm_r_sync(cwd + '/out/libs');
		fs.rm_r_sync(cwd + '/out/public');
	}
	new Build(cwd, cwd + '/out').build().catch(e=>console.error(e));
} else if (cmd == 'init') {
	new Build(cwd, cwd + '/out').init();
}
else if (cmd == 'install') {
	new Build(cwd, cwd + '/out').install_deps();
} 
else {
	// run wrb server
	server(argument.options);
}

export default {};