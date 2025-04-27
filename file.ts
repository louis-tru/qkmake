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

import { HttpService } from 'qktool/http_service';
import * as fs from 'qktool/fs2';
import * as remote_log from './remote_log';
import {gen_html} from './marked/html';
import {resolveLocal} from './build';

export default class File extends HttpService {

	static package_hash: string = '';
	static versions_json?: object;

	async onAction(info: any) {
		let log = 'Request: ' + this.url;
		console.log(log);
		remote_log.remote_log_print(log);

		if ( /.+\.(mdown|md)/i.test(this.pathname) ) {
			return this.marked({pathname:this.pathname});
		}
		else if ( /\/package.json$/.test(this.pathname) ) {
			return this.package_json({pathname:this.pathname});
		}
		else if ( /\/versions.json$/.test(this.pathname) ) {
			return this.versions_json({pathname:this.pathname});
		}
		await super.onAction(info);
	}

	marked_assets({pathname}: {pathname:string}) {
		this.returnFile(resolveLocal(__dirname, 'marked/assets', pathname));
	}

	async marked({pathname}: {pathname:string}) {
		let self = this;
		let filename = this.server.root[0] + '/' + pathname;
		let stat: fs.Stats;

		try { stat = await fs.stat(filename) } catch(err) {
			return self.returnErrorStatus(404);
		}

		if (!stat.isFile()) {
			return self.returnErrorStatus(404);
		}

		//for file
		if (stat.size > Math.min(self.server.maxFileSize, 5 * 1024 * 1024)) {
			//File size exceeds the limit
			return self.returnErrorStatus(403);
		}

		let mtime = stat.mtime;
		let ims = self.request.headers['if-modified-since'];
		let res = self.response;

		self.markCompleteResponse();
		self.setDefaultHeader();
		res.setHeader('Last-Modified', mtime.toUTCString());
		res.setHeader('Content-Type', 'text/html; charset=utf-8');

		if (ims && new Date(ims).valueOf() - mtime.valueOf() === 0) { //use 304 cache
			res.writeHead(304);
			res.end();
		} else {
			let buf = await fs.readFile(filename);
			let html = gen_html(buf.toString('utf8')).html;
			res.writeHead(200);
			res.end(html);
		}
	}

	package_json({pathname}: {pathname:string}) {
		let json: Dict = File.versions_json!;
		if (!json) {
			let root = this.server.root[0];
			let [json_path] = ['out/all','']
				.map(e=>resolveLocal(root, e, pathname))
				.filter(fs.existsSync);
			if (!json_path) {
				return this.returnErrorStatus(404);
			}
			this.markCompleteResponse();
			
			json = JSON.parse(fs.readFileSync(json_path, 'utf8'));
			json.hash = File.package_hash;
			json.pkgzHash = ''; // clear pkgz flag
		}
		let data = JSON.stringify(json, null, 2);
		let res = this.response;
		this.setNoCache();
		this.setDefaultHeader();
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.writeHead(200);
		res.end(data);
	}

	versions_json({pathname}: {pathname:string}) {
		let root = this.server.root[0];
		let [json_path] = ['out/all']
			.map(e=>resolveLocal(root, e, pathname))
			.filter(fs.existsSync);
		if (!json_path) {
			return this.returnErrorStatus(404);
		}
		this.setNoCache();
		this.returnFile(json_path);
	}

	siteFile({pathname}: {pathname:string}) {
		let root = this.server.root[0];
		let [s] = ['out/all','']
			.map(e=>resolveLocal(root, e, pathname))
			.filter(fs.existsSync);
		if (s && fs.statSync(s).isFile()) {
			this.returnFile(s);
		} else {
			this.returnSiteFile(pathname);
		}
	}

}