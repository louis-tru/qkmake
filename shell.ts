#!/usr/bin/env node

import util from 'suark';
import fs = require('suark/fs');
import QuarkBuild from './build';
import QuarkExport from './export';
import server from './server';
import * as argument from 'suark/arguments';

const args = process.argv.slice(2);
const cmd = args.shift();
const opts = argument.options;
const help_info = argument.helpInfo;
const def_opts = argument.defOpts;

def_opts(['help','h'], 0,       '-h, --help     print help info');
def_opts(['port', 'p'], 1026, 	'--port=PORT,-p PORT Run quark debugger server port [{0}]');
// def_opts(['remote', 'r'], '', 	'--remote=ADDRESS,-r ADDRESS Remote console address [none]');

if ( opts.help || opts.h /*cmd == 'help' || cmd == 'h'*/ ) {
	console.log('');
	console.log('Usage: qkmake COMMAND [OS]');
	console.log('Usage: qkmake [OPTION]...');
	console.log('');
	console.log('Examples:');
	console.log('`qkmake init`');
	console.log('`qkmake build`');
	console.log('`qkmake rebuild`');
	console.log('`qkmake export ios`');
	console.log('`qkmake export android`');
	console.log('`qkmake install`');
	console.log('`qkmake clear`');
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
	new QuarkExport(process.cwd(), args[0]).export().catch(e=>console.error(e));
} 
else if ( cmd == 'build' || cmd == 'rebuild' || cmd == 'init' ) {
	if ( cmd == 'rebuild' ) {
		fs.rm_r_sync(process.cwd() + '/out/install');
		fs.rm_r_sync(process.cwd() + '/out/libs');
		fs.rm_r_sync(process.cwd() + '/out/public');
	}
	var build = new QuarkBuild(process.cwd(), process.cwd() + '/out');
	if ( cmd == 'init' ) {
		build.initialize();
	} else {
		build.build().catch(e=>console.error(e));
	}
}
else if (cmd == 'install') {
	new QuarkBuild(process.cwd(), process.cwd() + '/out').install_depe();
} 
else if ( cmd == 'clear' ) {
	fs.rm_r_sync(process.cwd() + '/out');
}
else {
	// run wrb server
	server(argument.options);
}

export default {};