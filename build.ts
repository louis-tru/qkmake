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

import util from 'qktool';
import * as fs from 'qktool/fs';
import * as child_process from 'child_process';
import keys from 'qktool/keys';
import path from 'qktool/path';
import paths from './paths';
import { exec } from 'qktool/syscall';
const uglify = require('./uglify');

export const searchModules = 'node_modules';

const base64_chars =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'.split('');

const init_code = `
import { Application,Window,Jsx } from 'quark';

const app = new Application();

const win = new Window().render(
	<free width="match" height="match">
		<text value="Hello world" textSize={48} align="centerMiddle" />
	</free>
);
`;


const init_code2 = `

console.log('When the package has only one file, TSC cannot be compiled. This should be a bug of TSC');

`;

const init_editorconfig  = `
# top-most EditorConfig file
root = true

# all files
[*]  
indent_style = tab
indent_size = 2

`;

export const native_source = [
	'.c',
	'.cc',
	'.cpp',
	'.cxx',
	'.m',
	'.mm',
	'.s', 
	'.swift',
];

export const native_header = [
	'.h',
	'.hpp',
	'.hxx',
];

const skip_files = [
	...native_source,
	...native_header,
	'.gyp',
	'.gypi',
];

const init_tsconfig = {
	"compileOnSave": true,
	"compilerOptions": {
		"noEmitHelpers": true,
		"module": "commonjs",
		"target": "ES2018",
		"moduleResolution": "node",
		"sourceMap": false,
		"outDir": "out/build",
		"rootDir": ".",
		"baseUrl": ".",
		"declaration": true,
		"alwaysStrict": true,
		"allowJs": true,
		"checkJs": false,
		"strict": true,
		"noImplicitAny": true,
		"noImplicitThis": true,
		"strictNullChecks": true,
		"strictPropertyInitialization": false,
		"emitDecoratorMetadata": false,
		"experimentalDecorators": true,
		"removeComments": true,
		"jsx": "react",
		"jsxFactory": "Jsx",
		// "typeRoots" : ["../libs"],
		// "types" : ["node", "lodash", "express"],
		"incremental": true,
		"tsBuildInfoFile": "./out/tsbuildinfo"
	},
	"include": [
		"**/*",
	],
	"exclude": [
		"out",
		".git",
		"project",
		searchModules,
	]
};

export function resolveLocal(...args: string[]) {
	return path.classicPath(path.resolve(...args));
}

export function parse_json_file(filename: string, strict?: boolean) {
	try {
		var str = fs.readFileSync(filename, 'utf-8');
		if (strict) {
			return JSON.parse(str);
		} else {
			return eval('(\n' + str + '\n)');
		}
	} catch (err: any) {
		err.message = filename + ': ' + err.message;
		throw err;
	}
}

function exec_cmd(cmd: string) {
	var r = child_process.spawnSync('sh', ['-c', cmd]);
	if (r.status != 0) {
		if (r.stdout.length) {
			console.log(r.stdout + '');
		}
		if (r.stderr.length) {
			console.error(r.stderr + '');
		}
		process.exit(0);
	} else {
		var rv = [];
		if (r.stdout.length) {
			rv.push(r.stdout);
		}
		if (r.stderr.length) {
			rv.push(r.stderr);
		}
		return rv.join('\n');
	}
}

function new_zip(cwd: string, sources: string[], target: string) {
	console.log('Out ', path.basename(target));
	//console.log('; zip ' + target + ' ' + sources.join(' '))
	exec_cmd('cd ' + cwd + '; rm -r ' + target + '; zip ' + target + ' ' + sources.join(' '));
}

function unzip(source: string, target: string) {
	exec_cmd('cd ' + target + '; unzip ' + source);
}

function copy_file(source: string, target: string) {
	fs.mkdirpSync( path.dirname(target) ); // First make directory

	var rfd  = fs.openSync(source, 'r');
	var wfd  = fs.openSync(target, 'w');
	var size = 1024 * 100; // 100 kb
	var buff = Buffer.alloc(size);
	var len  = 0;
	var hash = new Hash();
	
	do {
		len = fs.readSync(rfd, buff, 0, size, null);
		fs.writeSync(wfd, buff, 0, len, null);
		hash.update_buff_with_len(buff, len); // update hash
	} while (len == size);
	
	fs.closeSync(rfd);
	fs.closeSync(wfd);
	
	return hash.digest32();
}

function read_file_text(pathname: string) {
	var buff = fs.readFileSync(pathname);
	var hash = new Hash();
	hash.update_buff(buff);
	return {
		value: buff.toString('utf-8'),
		hash: hash.digest32(),
	};
}

export interface PackageJson extends Dict {
	name: string;
	main: string;
	version: string;
	description?: string;
	scripts?: Dict<string>;
	author?: Dict<string>;
	keywords?: string[];
	license?: string;
	bugs?: Dict<string>;
	homepage?: string;
	devDependencies?: Dict<string>;
	dependencies?: Dict<string>;
	bin?: string;
	hash?: string;
	pkgzHash?: string;
	id?: string;
	app?: string;
	detach?: string | string[];
	skip?: string | string[];
	skipInstall?: number; // 0 | 1 only self | 2 all of self and modules
	minify?: boolean;
	symlink?: string;
	modules?: Dict<Dict<PackageJson>>;
}

type PkgJson = PackageJson;

export class Hash {
	hash = 5381n;

	update_str(input: string) {
		var hash = this.hash;
		for (var i = input.length - 1; i > -1; i--) {
			hash += (hash << 5n) + BigInt(input.charCodeAt(i));
		}
		this.hash = hash & 0xFFFFFFFFFFFFFFFFFFFFFFFFn; // use 128bit
	}

	update_buff(input: Buffer) {
		var hash = this.hash;
		for (var i = input.length - 1; i > -1; i--) {
			hash += (hash << 5n) + BigInt(input[i]);
		}
		this.hash = hash & 0xFFFFFFFFFFFFFFFFFFFFFFFFn;
	}

	update_buff_with_len(input: Buffer, len: number) {
		var hash = this.hash;
		for (var i = len - 1; i > -1; i--) {
			hash += (hash << 5n) + BigInt(input[i]);
		}
		this.hash = hash & 0xFFFFFFFFFFFFFFFFFFFFFFFFn;
	}

	digest32() {
		var value = this.hash & 0xFFFFFFFFn;
		var retValue = '';
		do {
			retValue += base64_chars[Number(value & 0x3Fn)];
		}
		while ( value >>= 6n );
		return retValue;
	}
	digest128() {
		var value = this.hash;
		var retValue = '';
		do {
			retValue += base64_chars[Number(value & 0x3Fn)];
		}
		while ( value >>= 6n );
		return retValue;
	}
}

class Package {
	private _output_name      = '';
	private _source           = '';
	private _target_small     = '';
	private _target_build       = '';
	private _target_types     = '';
	private _versions         = { filesHash: {} as Dict<string>, pkgzFiles: {} as Dict<string>};
	private _detach_file: string[] = [];
	private _skip_file: string[] = [];
	private _enable_minify     = false;
	private _tsconfig_outDir   = '';
	private _host: Build;
	private _skipInstall: number;

	readonly modules: Dict<Package> = {};
	readonly modules_symlink: Dict<Dict<PackageJson>> = {};
	readonly json: PkgJson;

	private console_log(tag: string, pathname: string, desc?: string) {
		console.log(tag, this._output_name + '/' + pathname, desc || '');
	}

	constructor(host: Build, source: string, output: string,
		outputName: string, json: PkgJson, skipInstall: number)
	{
		this._host = host;
		this._source = source;
		this.json = json;
		this._output_name  = outputName;
		this._target_small = resolveLocal(host.target_small, output);
		this._target_build = resolveLocal(host.target_build, output);
		this._target_types = resolveLocal(host.target_types, output);
		this._skip_file    = this.get_skip_files(this.json, outputName);
		this._detach_file  = this.get_detach_files(this.json, outputName);
		this._skipInstall  = skipInstall;
	}

	// getting skip files list
	// "name" pkg
	private get_skip_files(pkg_json: PkgJson, name: string) {
		var rev: string[] = [];

		if (pkg_json.skip) {
			if (Array.isArray(pkg_json.skip)) {
				rev = pkg_json.skip;
			} else {
				rev = [
					String(pkg_json.skip)
				];
			}
			delete pkg_json.skip;
		}

		rev.push('tsconfig.json');
		rev.push('binding.gyp');
		rev.push('versions.json');
		rev.push('package-lock.json');
		rev.push('out');
		rev.push('project');

		return rev;
	}

	// Getting detach of files list
	private get_detach_files(pkg_json: PkgJson, name: string) {
		var rev: string[] = [];
		
		if (pkg_json.detach) {
			if (Array.isArray(pkg_json.detach)) {
				rev = pkg_json.detach;
			} else {
				rev = [ String(pkg_json.detach) ];
			}
			delete pkg_json.detach;
		}
		return rev;
	}

	build() {
		let self = this;
		let source = self._source;
		let pkg_json = self.json;

		util.assert(/^https?:\/\//i.test(source) == false, 'path error that is cannot be HTTP path');

		if ( pkg_json.hash ) { // 已经build过,直接拷贝到目标
			self.copy_pkg(pkg_json, source);
			return;
		}

		let target_small = self._target_small;
		let target_build = self._target_build;

		if ( self._host.minify == -1 ) { // 使用package.json定义
			// package.json 默认不启用 `minify`
			self._enable_minify = 'minify' in pkg_json ? !!pkg_json.minify : false;
		} else {
			self._enable_minify = !!self._host.minify;
		}

		fs.removerSync(target_small);
		fs.removerSync(target_build);
		fs.mkdirpSync(target_small);
		fs.mkdirpSync(target_build);

		// build tsc
		if (fs.existsSync(source + '/tsconfig.json')) {
			self._tsconfig_outDir = this._target_build;
			let tsconfig = {
				extends: './tsconfig.json',
				exclude: [searchModules,'out','.git'],
				compilerOptions: {
					outDir: self._target_build,
					declarationDir: self._target_types,
					declaration: true,
				},
			};
			if (self === self._host.package) {
				tsconfig.exclude.push('project');
			}
			let json = parse_json_file(source + '/tsconfig.json');
			let tsBuildInfoFile = json.compilerOptions && json.compilerOptions.tsBuildInfoFile;
			if (tsBuildInfoFile) {
				fs.rm_r_sync(path.isAbsolute(tsBuildInfoFile) ?
					tsBuildInfoFile: resolveLocal(source, tsBuildInfoFile));
			}
			fs.writeFileSync(`${source}/.tsconfig.json`, JSON.stringify(tsconfig, null, 2));
			// exec_cmd(`cd ${source} && ${__dirname}/node_modules/.bin/tsc -project .tsconfig.json`);
			// exec_cmd(`cd ${source} && ${process.execPath} --inspect-brk=0.0.0.0:9228 ${__dirname}/qktsc -project .tsconfig.json`);
			exec_cmd(`cd ${source} && ${process.execPath} ${__dirname}/qktsc -project .tsconfig.json`);
			fs.unlinkSync(`${source}/.tsconfig.json`);
		}

		// each dir
		self.build_each_pkg_dir('', '');

		let pkgz_files = ['versions.json'];
		let versions = self._versions
		let hash = new Hash();

		for (let i in versions.pkgzFiles) {  // compute version code
			pkgz_files.push(`"${i}"`);
			hash.update_str(versions.pkgzFiles[i]);
		}
		pkg_json.pkgzHash = hash.digest128();

		for (let i in versions.filesHash) {
			hash.update_str(versions.filesHash[i]);
		}
		pkg_json.hash = hash.digest128();

		if (!self._skipInstall) { // no skil
			fs.writeFileSync(target_small + '/package.json', JSON.stringify(pkg_json, null, 2)); // rewrite package.json
			fs.writeFileSync(target_small + '/versions.json', JSON.stringify(versions, null, 2));
		}
		fs.writeFileSync(target_build + '/versions.json', JSON.stringify(versions, null, 2));
		fs.writeFileSync(target_build + '/package.json', JSON.stringify(pkg_json, null, 2)); // rewrite package.json

		new_zip(target_build, pkgz_files, target_build + '/' + pkg_json.name + '.pkgz');
	}

	private copy_js(source: string, target: string) {
		let self = this;
		let data = read_file_text(source);

		if (self._enable_minify) {
			let minify = uglify.minify(data.value, {
				toplevel: true,
				keep_fnames: false,
				mangle: {
					toplevel: true,
					reserved: [ '$' ],
					keep_classnames: true,
				},
				output: { ascii_only: true },
			});
			if ( minify.error ) {
				let err = minify.error;
				err = new SyntaxError(
					`${err.message}\n` +
					`line: ${err.line}, col: ${err.col}\n` +
					`filename: ${source}`
				);
				throw err;
			}
			data.value = minify.code;

			let hash = new Hash();
			hash.update_str(data.value);
			data.hash = hash.digest32();
		}

		if (source != target || self._enable_minify) {
			fs.mkdirpSync(path.dirname(target)); // First create directory
			fs.writeFileSync(target, data.value, 'utf8');
		}

		return data.hash;
	}

	private write_string(pathname: string, content: string) {
		let self = this;
		let target_build  = resolveLocal(self._target_build, pathname);
		let target_small  = resolveLocal(self._target_small, pathname);
		fs.mkdirpSync( path.dirname(target_build) ); // First create directory
		fs.writeFileSync(target_build, content, 'utf8');
		let hash = new Hash();
		hash.update_str(content);
		self._versions.pkgzFiles[pathname] = hash.digest32(); // recording hash

		if (!self._skipInstall) {
			fs.cp_sync(target_build, target_small);
		}
	}

	private build_file(pathname: string) {
		let self = this;
		// skip files
		for (let name of self._skip_file) {
			if ( pathname.indexOf(name) == 0 ) { // skip this file
				self.console_log('Skip', pathname);
				return;
			}
		}
		let source        = resolveLocal(self._source, pathname);
		let target_small  = resolveLocal(self._target_small, pathname);
		let target_build  = resolveLocal(self._target_build, pathname);
		let extname       = path.extname(pathname).toLowerCase();
		let is_detach     = false;
		var hash          = '';

		if (skip_files.indexOf(extname) != -1) {
			return; // skip native file
		}

		for (let i = 0; i < self._detach_file.length; i++) {
			let name = self._detach_file[i];
			if (pathname.indexOf(name) === 0) {
				is_detach = true; // detach this file
				break;
			}
		}

		switch (extname) {
			case '.js':
				self.console_log('Out ', pathname);
				if (self._tsconfig_outDir) {
					let s = `${self._tsconfig_outDir}/${pathname}`;
					if (fs.existsSync(s)) {
						// Make sure is latest time else use raw source
						if (fs.statSync(s).atime > fs.statSync(source).atime)
							source = s;
					}
				}
				hash = self.copy_js(source, target_build);
				break;
			case '.ts':
			case '.tsx':
			case '.jsx':
				if (pathname.substring(-2 - extname.length, 2) == '.d') { // typescript define
					return; // no copy declaration file
				}
				else if (self._tsconfig_outDir) {
					pathname = pathname.substring(0, pathname.length - extname.length) + '.js';
					target_small = resolveLocal(self._target_small, pathname); // rename ts to js
					target_build = resolveLocal(self._target_build, pathname);
					hash = self.copy_js(`${self._tsconfig_outDir}/${pathname}`, target_build);
				} else {
					self.console_log('Ignore', pathname, 'No tsconfig.json');
					return;
				}
				break;
			case '.keys':
				self.console_log('Out ', pathname);
				let data = null;
				var {hash,value} = read_file_text(source);
				try {
					data = keys.parse(value);
				} catch(err) {
					console.error('Parse keys file error: ' + source);
					throw err;
				}
				fs.mkdirpSync(path.dirname(target_build)); // First create directory
				fs.writeFileSync(target_build, keys.stringify(data), 'utf8');
				break;
			default:
				self.console_log('Copy', pathname);
				hash = copy_file(source, target_build);
				break;
		}

		if (!self._skipInstall) { // copy to small
			fs.cp_sync(target_build, target_small);
		}

		if ( is_detach ) {
			self._versions.filesHash[pathname] = hash;
		} else {
			self._versions.pkgzFiles[pathname] = hash; // add hash to pkgz
		}
	}

	private build_each_pkg_dir(pathname: string, basename: string) {
		let self = this;
		let source = resolveLocal(self._source, pathname);

		if (basename == searchModules) {
			for (let stat of fs.listSync(source)) {
				if (stat.name == '@types') continue;
				let pkg_path = source + '/' + stat.name;
				if (stat.isDirectory() && fs.existsSync( pkg_path + '/package.json')) {
					let isRoot = self === self._host.package && pathname == searchModules;
					let json = parse_json_file(pkg_path + '/package.json');
					let outname = isRoot ? json.name: `${json.name}@${json.version}`;

					if (!self._host.package.modules[outname]) {
						// skipInstall value is inherit from parent ??
						let skipInstall = self._skipInstall == 2 ? 2: (json.skipInstall || 0);
						let pkg = new Package(self._host, pkg_path,
								`${searchModules}/${outname}`, outname, json, skipInstall);
						pkg.build();
						self._host.package.modules[outname] = pkg;
					}

					if (!isRoot) { // Ignore root module
						let symlink = path.relative(`${self._target_build}/${pathname}`,
							`${self._host.target_build}/${searchModules}/${outname}`);
						let dir = self.modules_symlink[pathname];
						if (!dir) 
							self.modules_symlink[pathname] = dir = {};
						dir[outname] = { ...json, symlink };

						self.write_string(`${pathname}/${json.name}.link`, symlink);
					}
				}
			}
		} else {
			for (var stat of fs.listSync(source)) {
				if (stat.name[0] != '.' || !self._host.ignore_hide) {
					if (['project','out','package-lock.json','tsconfig.json'].indexOf(stat.name) == -1) {
						var basename = stat.name;
						let path = pathname ? pathname + '/' + basename : basename; 
						if ( stat.isFile() ) {
							self.build_file(path);
						} else if ( stat.isDirectory() ) {
							self.build_each_pkg_dir(path, basename);
						}
					} // if (['package-lock.json
				}
			}
		}
	}

	private copy_pkg(pkg_json: PkgJson, source: string) {
		let self = this;
		util.assert(pkg_json.hash, 'Error');

		let name = pkg_json.name;
		let target_build = `${self._target_build}/${name}`;
		let target_small = `${self._target_small}/${name}`;

		// copy to dest
		fs.cp_sync(source, target_build, { ignore_hide: this._host.ignore_hide });

		if ( fs.existsSync(`${source}/${name}.pkgz`) ) { // there's local has the .pkgz file
			unzip(`${source}/${name}.pkgz`, target_build); // unzip .pkgz
		}
		else { // no .pkgz file
			let pkgzFiles = parse_json_file(`${source}/versions.json`).pkgzFiles;
			let pkg_files = ['versions.json'];
			for ( let i in pkgzFiles ) {
				pkg_files.push(`"${i}"`);
			}
			new_zip(source, pkg_files, `${target_build}/${name}.pkgz`);
			fs.cp_sync(`${source}/package.json`, `${target_build}/package.json`);
		}

		if (!pkg_json.skipInstall) {
			// copy to small
			fs.cp_sync(target_build, target_small, { ignore_hide: this._host.ignore_hide, isCancel: s=>{
				return path.extname(s) == `.pkgz`; // ignore copy .pkgz
			} });
		}
	}
}

export default class Build {
	readonly source: string;
	readonly target: string;
	readonly target_small: string;
	readonly target_build: string;
	readonly target_types: string;
	readonly package: Package;

	ignore_hide = true; // Ignore the hidden files
	// Compress and obfuscate js code, -1 means use definition of package.json
	minify = -1;

	constructor(source: string, target: string) {
		util.assert(!/^https?:\/\//i.test(source),
			`Source path error that is cannot be HTTP path ${source}`);

		this.source        = resolveLocal(source);
		this.target        = target;
		this.target_small  = resolveLocal(target, 'small');
		this.target_build  = resolveLocal(target, 'build');
		this.target_types  = resolveLocal(target, 'types');

		util.assert(fs.existsSync(this.source), `Build source does not exist ,${this.source}`);
		util.assert(fs.statSync(this.source).isDirectory());
	}

	private copy_outer_file(items: Dict<string>, skipInstall?: number) {
		let self = this;
		for (let source in items) {
			let target = items[source] || source;
			console.log('Copy', source);
			if (!skipInstall) {
				fs.cp_sync(self.source + '/' + source,
									self.target_small + '/' + target, { ignore_hide: self.ignore_hide });
			}
			fs.cp_sync(self.source + '/' + source,
								self.target_build + '/' + target, { ignore_hide: self.ignore_hide });
		}
	}

	async install_deps(args?: string[]) {
		if ( !fs.existsSync(`${this.source}/package.json`) ) {
			console.warn('No installed anything');
			return ;
		}

		console.log(`Install dependencies ...`);
		process.stdin.resume();

		let r = await exec(`npm install --only=prod ${(args || []).join(' ')}`, { // --ignore-scripts
			stdout: process.stdout,
			stderr: process.stderr, stdin: process.stdin,
		});
		process.stdin.pause();

		util.assert(r.code === 0, 'Installed fail');

		if (!fs.existsSync(`${searchModules}/@types/quark`)) { // copy @types
			fs.cp_sync(paths.types, `${searchModules}/@types`);
		}
	}

	async build() {
		util.assert(fs.existsSync(`${this.source}/package.json`), 'Not found file package.json');

		fs.mkdirpSync(this.target_small);
		fs.mkdirpSync(this.target_build);

		let self = this;
		let json = parse_json_file('package.json');
		let skipInstall = json.skipInstal || 0;

		if ('@copy' in json) {
			self.copy_outer_file(json['@copy'], skipInstall);
		}
		await self.install_deps();

		let pkg = new Package(this, this.source, '', json.name, json, skipInstall);
		(self as any).package = pkg;
		pkg.build();

		pkg.json.modules = {};
		self.genSaerchModules(pkg, pkg.json.modules);
		// rewrite package.json
		fs.writeFileSync(this.target_build + '/package.json', JSON.stringify(pkg.json, null, 2));
	}

	private genSaerchModules(pkg: Package, outModules: Dict<Dict<PackageJson>>) {
		for (let [k,_pkg] of Object.entries(pkg.modules)) {
			let dir = outModules[searchModules] || (outModules[searchModules] = {});
			dir[k] = _pkg.json;
			this.genSaerchModules(_pkg, (_pkg.json.modules = {}));
		}
		for (let [k,v] of Object.entries(pkg.modules_symlink)) {
			let dir = outModules[k] || (outModules[k] = {})
			for (let [mod,json] of Object.entries(v)) {
				dir[mod] = json;
			}
		}
	}

	/**
	 * @method init() init package
	 */
	init(examples?: string) {
		util.assert(fs.readdirSync(process.cwd()).length == 0, 'Directory must be empty');

		for (let pkg of paths.default_modules) {
			let pathname = `${searchModules}/${path.basename(pkg)}`;
			if (!fs.existsSync(pathname)) { // if no exists then copy
				fs.cp_sync(pkg, pathname); // copy pkgs
			}
		}
		fs.cp_sync(paths.types, `${searchModules}/@types`);

		if (examples == 'examples') {
			fs.cp_sync(paths.examples, this.source);
		} else {
			let name = path.basename(process.cwd()) || 'qkproj';
			let json = {
				name,
				app: name[0].toUpperCase() + name.substring(1),
				id: `org.quark.${name}`,
				main: 'index.js',
				types: 'index',
				version: '1.0.0',
				description: "",
				dependencies: {}
			};
			// init_tsconfig.compilerOptions.outDir = `out/build`;

			fs.writeFileSync('package.json', JSON.stringify(json, null, 2));
			fs.writeFileSync('index.tsx', init_code);
			fs.writeFileSync('test.ts', init_code2);
			fs.writeFileSync('tsconfig.json', JSON.stringify(init_tsconfig, null, 2));
			fs.writeFileSync('.editorconfig', init_editorconfig);
			fs.writeFileSync('.gitignore', ['.vscode', '*.DS_Store',
				searchModules, 'out', 'project', '*.gyp', '.tsconfig.json'].join('\n'));
		}
	}

}