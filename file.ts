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
import path from 'qktool/path';
import * as fs from 'qktool/fs';
import * as remote_log from './remote_log';
import {gen_html} from './marked/html';

function resolveLocal(...args: string[]) {
	return path.fallbackPath(path.resolve(...args));
}

export default class File extends HttpService {

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
		super.onAction(info);
	}

	marked_assets({pathname}: {pathname:string}) {
		this.returnFile(resolveLocal(__dirname, 'marked/assets', pathname));
	}

	marked({pathname}: {pathname:string}) {
		let self = this;
		let filename = this.server.root[0] + '/' + pathname;

		return new Promise<void>((ok)=>{

			fs.stat(filename, function (err, stat) {

				if (err) {
					return self.returnErrorStatus(404), ok();
				}
				
				if (!stat.isFile()) {
					return self.returnErrorStatus(404), ok();
				}
				
				//for file
				if (stat.size > Math.min(self.server.maxFileSize, 5 * 1024 * 1024)) { 
					//File size exceeds the limit
					return self.returnErrorStatus(403), ok();
				}
				
				let mtime = stat.mtime;
				let ims = self.request.headers['if-modified-since'];
				let res = self.response;
	
				self.setDefaultHeader();
				res.setHeader('Last-Modified', mtime.toUTCString());
				res.setHeader('Content-Type', 'text/html; charset=utf-8');
	
				if (ims && new Date(ims).valueOf() - mtime.valueOf() === 0) { //use 304 cache
					res.writeHead(304);
					res.end(), ok();
					return;
				}
				
				fs.readFile(filename, function(err, data) {
					if (err) {
						return self.returnErrorStatus(404), ok();
					}
					// template, title, text_md, no_index
					let res = self.response;
					let html = gen_html(data.toString('utf8')).html;
					res.writeHead(200);
					res.end(html);
					ok();
				});
	
			});
		});
	}

	package_json({pathname}: {pathname:string}) {
		let root = this.server.root[0];
		let [json_path] = ['out/all','']
			.map(e=>resolveLocal(root, e, pathname))
			.filter(fs.existsSync);
		if (!json_path) {
			return this.returnErrorStatus(404);
		}
		this.markCompleteResponse();
		let res = this.response;
		let json = JSON.parse(fs.readFileSync(json_path, 'utf8'));
		json.hash = '';
		json.pkgzHash = ''; // clear pkgz flag
		let data = JSON.stringify(json, null, 2);
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