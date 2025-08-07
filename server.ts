/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2015, blue.chu
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of blue.chu nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL blue.chu BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * 
 * ***** END LICENSE BLOCK ***** */

import 'qktool/_util';
import Console from './console';
import File from './file';
import config from './config';
import Message from './message';
import {ServerImpl,Options} from 'qktool/server';
import * as remote_log from './remote_log';
import {getLocalNetworkHost} from 'qktool/network_host';
import { saerchModules, parse_json_file, Hash } from './build';
import * as fs from 'fs';
import * as ts from 'typescript';
import path from 'qktool/path';

process.on('unhandledRejection', (err, promise) => {
	throw err;
});

interface Opt {
	remoteLog?: string, server?: Partial<Options>
};

export default function start_server(options?: Opt) {
	let opts = options || {};

	if (opts.remoteLog) {
		remote_log.set_remote_log_address(opts.remoteLog);
	}
	if (opts.server?.router) {
		opts.server.router.push(...config.server.router);
	}

	let ser = new ServerImpl({ ...config.server, ...opts.server});

	ser.setService('File', File);
	ser.setService('Console', Console);
	ser.setService('Message', Message);

	ser.start().then(()=>{
		console.log( 'Start web server:' );
		getLocalNetworkHost().forEach(function(address) {
			console.log('  http://' + address + ':' + ser.port + '/');
		});
	});

	return ser;
}

export async function start(runPoint: string, opts?: Opt) {
	let src = path.classicPath(path.resolve(runPoint));
	let ser = start_server(opts);
	let tsconfig = {
		extends: `./tsconfig.json`, 
		exclude: [saerchModules,'project','out','.git'],
	};
	fs.writeFileSync(`${src}/.tsconfig.json`, JSON.stringify(tsconfig, null, 2));

	let sys = Object.create(ts.sys) as (typeof ts.sys);
	let out_build = `${src}/out/build/`;
	let pkg_json = parse_json_file(`${out_build}package.json`);
	let {filesHash,pkgzFiles} = parse_json_file(`${out_build}versions.json`);
	let allFiles = Object.keys({...pkgzFiles, ...filesHash});

	File.versions_json = {filesHash, pkgzFiles};
	File.package_hash = pkg_json.hash || '';
	File.watching = true;

	let delaySaveId: NodeJS.Timeout;
	function delaySaveToLocal() {
		clearTimeout(delaySaveId);
		delaySaveId = setTimeout(saveToLocal, 30e3); // 30 second
	}

	function saveToLocal() {
		fs.writeFileSync(`${out_build}versions.json`, JSON.stringify({filesHash,pkgzFiles}, null, 2));
		fs.writeFileSync(`${out_build}package.json`, JSON.stringify(pkg_json, null, 2));
	}

	process.on('exit', saveToLocal);
	process.on('SIGINT', ()=>process.exit());

	sys.writeFile = function(pathname: string, data: string, writeByteOrderMark?: boolean) {
		if (path.extname(pathname) == '.js') {
			let fileName = pathname.substring(out_build.length);
			let hash = new Hash();
			hash.update_str(data);
			let hashStr = hash.digest32();
			filesHash[fileName] = hashStr;

			hash = new Hash();
			for (let file of allFiles)
				hash.update_str(filesHash[file] || pkgzFiles[file]);
			pkg_json.hash = hash.digest128();
			delaySaveToLocal();

			// Emit notification to debug clients
			Message.triggerClients(ser, 'FileChanged', { fileName, hash: hashStr });
			console.log('Changed:', fileName);
		}
		ts.sys.writeFile(pathname, data, writeByteOrderMark);
	}

	let watchCompilerHost = ts.createWatchCompilerHost(
		`${src}/.tsconfig.json`,
		{
			outDir: `${src}/out/build`,
			declarationDir: `${src}/out/types`,
			declaration: true,
		},
		sys,
		ts.createEmitAndSemanticDiagnosticsBuilderProgram,
		(diagnostic) => {
			if (diagnostic.file) {
				console.log('Error: from', diagnostic.file!.fileName.substring(src.length));
			}
			console.log('  ', diagnostic.messageText);
		},
		(status) => {
			if (status.category === ts.DiagnosticCategory.Message) {
				// console.log('File changed:', status);
			}
		}
	);
	ts.createWatchProgram(watchCompilerHost);

	setTimeout(()=>console.log('Watching files change:'));
}