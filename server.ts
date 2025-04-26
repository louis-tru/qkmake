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
import {ServerImpl,Options} from 'qktool/server';
import * as remote_log from './remote_log';
import {getLocalNetworkHost} from 'qktool/network_host';
import { saerchModules } from './build';
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

	ser.start().then(()=>{
		console.log( 'Start web server:' );
		getLocalNetworkHost().forEach(function(address) {
			console.log('  http://' + address + ':' + ser.port + '/');
		});
	});

	return ser;
}

export async function start(runPoint: string, opts?: Opt) {
	let src = path.fallbackPath(path.resolve(runPoint));
	let ser = start_server(opts);
	let tsconfig = {
		extends: `./tsconfig.json`, 
		exclude: [saerchModules,'Project','out','.git','.svn'],
	};
	fs.writeFileSync(`${src}/.tsconfig.json`, JSON.stringify(tsconfig, null, 2));

	let sys = Object.create(ts.sys) as (typeof ts.sys);
	let out_all = `${src}/out/all`;

	sys.writeFile = function(pathname: string, data: string, writeByteOrderMark?: boolean) {
		if (path.extname(pathname) == '.js') {
			// TODO: Emit notification to debug clients
			console.log('Changed:', pathname.substring(out_all.length));
		}
		ts.sys.writeFile(pathname, data, writeByteOrderMark);
	}

	let watchCompilerHost = ts.createWatchCompilerHost(
		`${src}/.tsconfig.json`,
		{
			outDir: `${src}/out/all`,
			declarationDir: `${src}/out/types`,
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
}