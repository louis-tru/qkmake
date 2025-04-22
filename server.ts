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

import 'encark/_util';
import Console from './console';
import File from './file';
import config from './config';
import {ServerImpl} from 'encark/server';
import * as remote_log from './remote_log';
import {getLocalNetworkHost} from 'encark/network_host';

process.on('unhandledRejection', (err, promise) => {
	throw err;
});

export default function start_server(options?: {
	remoteLog?: string,
	server?: {
		port?: number,
		router?: {match:string, service?: string, action?: string}[],
	},
}) {
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
		console.log( 'start web server:' );
		//console.log('    http://' + ser.host + ':' + ser.port + '/');
		getLocalNetworkHost().forEach(function(address) {
			console.log('    http://' + address + ':' + ser.port + '/');
		});
	});

	return ser;
}