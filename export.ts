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

import util from 'qktool/util';
import paths from './paths';
import * as fs from 'qktool/fs';
import path from 'qktool/path';
import {syscall,execSync,exec} from 'qktool/syscall';
import Build, {
	PackageJson,native_source,
	native_header,parse_json_file, resolveLocal, saerchModules
} from './build';
import { getLocalNetworkHost } from 'qktool/network_host';

const platform = process.platform;
const host_os = platform == 'darwin' ? 'mac': platform;
const isWindows = host_os == 'win32';

function filter_repeat(array: string[], ignore?: string) {
	let r: Dict = {};
	array.forEach(function(item) { 
		if ( !ignore || ignore != item ) {
			r[item] = 1;
		}
	});
	return Object.getOwnPropertyNames(r);
}

function xdgOpen(arg: string) {
	if (host_os == 'linux') {
		if (execSync(`which xdg-open`).code == 0) {
			exec(`xdg-open ${arg}`); // open project
			setTimeout(e=>process.exit(0),1e3); // force exit
		}
	}
}

type PkgJson = PackageJson;

interface OutputGypi extends Dict {}

class Package {
	private _binding = false;
	private _binding_gyp = false;
	private _native = false;
	private _gypi: OutputGypi | null = null;

	readonly host: Export;
	readonly outputName: string;
	readonly gypi_path: string;
	readonly source: string;
	readonly json: PkgJson;
	readonly is_app: boolean;
	readonly includes: string[] = [];
	readonly include_dirs: string[] = [];
	readonly sources: string[] = [];
	readonly dependencies: string[] = [];
	readonly dependencies_recursion: string[] = [];
	readonly bundle_resources: string[] = [];

	get native() {
		return this._native;
	}

	get gypi() {
		util.assert(this._gypi);
		return this._gypi as OutputGypi;
	}

	get_start_argv() {
		let self = this;
		if (self.is_app) {
			let name = self.outputName;
			let json = self.json;
			let inspect = ' --inspect=0.0.0.0:9229';
			let start_argv_debug = 'http://' + getLocalNetworkHost()[0] + ':1026/' + inspect;
			if (json.skipInstall) {
				console.warn( 'skipInstall params May lead to Application', name, ' to start incorrectly' );
			}
			return [start_argv_debug, `.${inspect}`, '.'];
		}
		return [] as string[];
	}

	constructor(host: Export, source: string, outputName: string, json: PkgJson, is_app?: boolean) {
		this.host = host;
		this.source = source;
		this.json = json;
		this.is_app = is_app || false;
		this.outputName = outputName;
		this.gypi_path = host.output + '/' + outputName + '.gypi';
	}

	private get_dependencies() {
		let self = this;
		let pkgs: Package[] = [];
		let outputs = self.host.outputs;
		for (let [k,v] of Object.entries((self.json.dependencies || {}) as Dict<string>)) {
			// TODO looking for the right package
			let version = v.replace(/^(~|\^)/, '');
			let fullname = k + '@' + version;
			let pkg = outputs[fullname];
			if (!pkg) {
				fullname = k;
				pkg = outputs[fullname];
			}
			if (pkg) {
				pkgs.push(pkg);
			}
		}
		return pkgs;
	}

	private _dependencies_recursion(Out: Set<Package>) {
		let self = this;
		for (let pkg of self.get_dependencies()) {
			Out.add(pkg);
			pkg._dependencies_recursion(Out);
		}
	}

	private get_dependencies_recursion() {
		let pkgs: Package[] = [];
		let set = new Set<Package>();
		this._dependencies_recursion(set);
		for (let pkg of set) {
			pkgs.push(pkg);
		}
		return pkgs;
	}

	// reset app resources
	private gen_before() {
		let self = this;
		let deps = self.get_dependencies_recursion();
		let is_app = self.is_app;

		self.dependencies_recursion.push(...self.dependencies);

		for (let pkg of self.get_dependencies()) {
			self.dependencies.push(pkg.outputName);
		}

		if (is_app) {
			let skip_resources = [
				'package-lock.json',
			];
			for (let pkg of deps) {
				self.includes.push(pkg.gypi_path);
				self.dependencies_recursion.push(pkg.outputName);
			}
			for (let file of fs.readdirSync(`${self.host.output}/small`)) {
				if (path.basename(file).indexOf('run') != 0) { // skip run* files
					if (skip_resources.indexOf(file) == -1)
						self.bundle_resources.push(`small/${file}`);
				}
			}
			self.includes.splice(0, Infinity, ...filter_repeat(self.includes));
			self.dependencies_recursion.splice(0, Infinity, ...filter_repeat(self.dependencies_recursion, this.outputName));
			self.bundle_resources.splice(0, Infinity, ...filter_repeat(self.bundle_resources));
		}

		self.dependencies.splice(0, Infinity, ...filter_repeat(self.dependencies, this.outputName));

		if (self._binding || self._binding_gyp) {
			self._native = true;
		} else { // is native
			for (let pkg of deps) {
				if (pkg._native || pkg._binding || pkg._binding_gyp) {
					this._native = true;
					break;
				}
			}
		}
	}

	init() {
		let self = this;
		let host = this.host;
		let source = this.source;
		let relative_source = path.relative(host.output, source);

		// add native and source
		if ( fs.existsSync(source + '/binding.gyp') ) {
			let targets = parse_json_file(source + '/binding.gyp').targets as any[];
			if (targets.length) {
				let target = targets[0];
				let target_name = target.target_name;
				if (target_name) {
					self.dependencies.push(path.relative(host.source, source) + '/binding.gyp:' + target_name);
					self._binding_gyp = true;
				}
			}
		}

		let is_include_dirs = false;
		let skip_source = [
			'out',
			'project',
			saerchModules,
			'package-lock.json',
			`${self.json.name}.gyp`
		];

		// add source
		fs.listSync(source, true, function(stat, pathname) {
			let name = stat.name;
			if (name[0] == '.')
				return true; // cancel each
			if (skip_source.indexOf(name) != -1)
				return true;
			if ( stat.isFile() ) {
				let extname = path.extname(name).toLowerCase();
				if (native_source.indexOf(extname) != -1) {
					if (!self._binding_gyp) {
						self._binding = true;
						self.sources.push( relative_source + '/' + pathname );
					} // else not add native source
					is_include_dirs = true;
				} else {
					if (native_header.indexOf(extname) != -1) {
						is_include_dirs = true;
					}
					self.sources.push( relative_source + '/' + pathname );
				}
			} else if ( stat.isDirectory() ) {
				if (name == saerchModules) {
					let dirname = source + '/' + pathname;
					fs.listSync(dirname, function(stat, pathname) {
						if (pathname && stat.isDirectory() && stat.name != '@types')
							host.add_module(dirname + '/' + stat.name, false, true);
					});
					return true; // cancel each children
				}
			}
		});

		if ( is_include_dirs ) {
			self.include_dirs.push(relative_source);
		}
	}

	private gen_xcode_gypi(): OutputGypi {
		let self = this;
		let is_app = self.is_app;
		let name = self.outputName;
		let host = self.host;
		let sources = self.sources;
		let id = self.json.id || 'org.quark.${PRODUCT_NAME:rfc1034identifier}';
		let app_name = self.json.app || '${PRODUCT_NAME}';//'${EXECUTABLE_NAME}';
		let version = self.json.version;
		let main = 'main';

		if (is_app) { // copy platfoem file
			let out = host.proj_out;
			let template = `${__dirname}/export/${host.os}`;
			let plist = `${out}/${main}.plist`;
			let str, reg;

			// .plist
			fs.cp_sync(`${template}/main.plist`, plist, { replace: false });
			str = fs.readFileSync(plist).toString('utf8');
			reg = /(\<key\>CFBundleIdentifier\<\/key\>\n\r?\s*\<string\>)([^\<]+)(\<\/string\>)/;
			str = str.replace(reg, function(a,b,c,d) { return b + id + d });
			reg = /(\<key\>CFBundleDisplayName\<\/key\>\n\r?\s*\<string\>)([^\<]+)(\<\/string\>)/;
			str = str.replace(reg, function(a,b,c,d) { return b + app_name + d });
			reg = /(\<key\>CFBundleShortVersionString\<\/key\>\n\r?\s*\<string\>)([^\<]+)(\<\/string\>)/;
			if (version) str = str.replace(reg, function(a,b,c,d) { return b + version + d });

			str = str.replace('[Storyboard]', `${main}.storyboard`);
			fs.writeFileSync( plist, str );
			// .storyboard
			fs.cp_sync(`${template}/${main}.storyboard`, `${out}/${main}.storyboard`, { replace: false } );
			// .xcassets
			fs.cp_sync(`${template}/Images.xcassets`, `${out}/Images.xcassets`, { replace: false } );
			// launchImage
			fs.cp_sync(`${template}/launch/launch.png`, `${out}/launch/launch.png`, { replace: false } );
	
			self.bundle_resources.push(`../project/<(os)/${main}.storyboard`);
			self.bundle_resources.push('../project/<(os)/Images.xcassets');
			self.bundle_resources.push('../project/<(os)/launch/launch.png');

			if (!fs.existsSync(`${out}/${main}.mm`)) { // main.mm
				let start_argv = self.get_start_argv();
				str = fs.readFileSync(`${template}/main.mm`).toString('utf8');
				str = str.replace(/ARGV_DEBUG/, `"${start_argv[0]}"`);
				str = str.replace(/ARGV_DEBUG1/, `fs_resources("${start_argv[1]}")`);
				str = str.replace(/ARGV_RELEASE/, `fs_resources("${start_argv[2]}")`);
				fs.writeFileSync(`${out}/${main}.mm`, str);
			}
			sources.push(`../project/<(os)/${main}.plist`);
			sources.push(`../project/<(os)/${main}.mm`);
		}

		// create gypi json data

		let type = is_app ? 'executable' : self._binding ? 'static_library' : 'none';
		let gypi = 
		{
			'targets': [
				{
					'variables': is_app ? {
						'XCODE_INFOPLIST_FILE': '$(SRCROOT)/project/<(os)/' + main + '.plist'
					} : {},
					'target_name': name,
					'product_name': name,
					'type': type,
					'include_dirs': self.include_dirs,
					'dependencies': is_app ? self.dependencies_recursion: self.dependencies,
					'direct_dependent_settings': {
						'include_dirs': is_app ? [] : self.include_dirs,
					},
					'sources': sources,
					'mac_bundle': is_app ? 1 : 0,
					'mac_bundle_resources': is_app ? self.bundle_resources : [],
					'xcode_settings': is_app ? {
						'INFOPLIST_FILE': '<(XCODE_INFOPLIST_FILE)',
						'SKIP_INSTALL': 'NO',
						'ASSETCATALOG_COMPILER_APPICON_NAME': 'AppIcon',
						// 'ASSETCATALOG_COMPILER_LAUNCHIMAGE_NAME': 'LaunchImage',
						'PRODUCT_BUNDLE_IDENTIFIER': id,
					}: {},
				}
			]
		};

		return gypi;
	}

	private gen_gypi(): OutputGypi { // android / linux
		let self = this;
		let is_app = self.is_app;
		let name = self.outputName;
		let host = self.host;
		let sources = self.sources;
		let str: string;
		let os = host.os;
		let out = host.proj_out;
		let template = `${__dirname}/export/${os}/`;
		let main = `${out}/main.cc`;

		// create gypi json data
		let type = 'none';
		if ( is_app ) {
			if (os == 'android') {
				if ( self.native ) {
					type = 'shared_library';
					if ( !self._binding ) {
						fs.cp_sync(`${__dirname}/export/empty.c`,
							`${host.output}/empty.c`, { replace: false });
						sources.push('empty.c');
					}
				}
			} else { // linux
				type = 'executable';
				if (!fs.existsSync(main)) { // main.cc
					let start_argv = self.get_start_argv();
					str = fs.readFileSync(template + 'main.cc').toString('utf8');
					str = str.replace(/ARGV_DEBUG/, `"${start_argv[0]}"`);
					str = str.replace(/ARGV_DEBUG1/, `fs_resources("${start_argv[1]}")`);
					str = str.replace(/ARGV_RELEASE/, `fs_resources("${start_argv[2]}")`);
					fs.writeFileSync(main, str);
				}
				sources.push(`../project/linux/main.cc`);
				fs.cp_sync(template, out, { replace: false });
				str = fs.readFileSync(`${out}/Makefile`, 'utf-8');
				str = str.replace(/^TARGET_NAME\s*\??=.*/gm, `TARGET_NAME = ${name}`);
				fs.writeFileSync(`${out}/Makefile`, str);
				fs.cp_sync(`${__dirname}/export/run.sh`, `${out}/run.sh`, { replace: false });
				fs.chmodSync(`${out}/run.sh`, 0o755);
			}
		} else if ( self._binding ) {
			type = 'static_library';
		}

		let gypi =
		{
			'targets': [
				{
					'target_name': name,
					'type': type,
					'include_dirs': self.include_dirs,
					'dependencies': is_app ? self.dependencies_recursion: self.dependencies,
					'direct_dependent_settings': {
						'include_dirs': is_app ? [] : self.include_dirs,
					},
					'sources': sources,
					'ldflags': os == 'linux' ? [
						'${LDFLAGS}',
						// '-Wl,-rpath=\\$$ORIGIN/run/linux/${ARCH}'
					]: []
				}
			]
		};

		return gypi;
	}

	gen() {
		if (!this._gypi) {
			this.gen_before();
			let os = this.host.os;
			if (os == 'ios' || os == 'mac') {
				this._gypi = this.gen_xcode_gypi();
			} else if (os == 'android' || os == 'linux') {
				this._gypi = this.gen_gypi();
			} else {
				throw new Error('Not support');
			}
		}
		return this._gypi;
	}
}

export default class Export {
	readonly source: string;
	readonly output: string;
	readonly proj_out: string;
	readonly os: string;
	readonly bundle_resources: string[] = [];
	readonly outputs: Dict<Package>;
	private package: Package; // root

	constructor(source: string, os: string) {
		util.assert(!/^https?:\/\//i.test(source),
			`Source path error that is cannot be HTTP path ${source}`);
		util.assert(
			os == 'android' ||
			os == 'linux' ||
			os == 'mac' ||
			os == 'ios', `Do not support ${os} os export, Only OS for the ios android amc and linux`);
		util.assert(fs.existsSync(`${source}/package.json`),
			`Export source does not exist, file package.json`);

		this.source = resolveLocal(source);
		this.output = resolveLocal(source, 'out');
		this.proj_out = resolveLocal(source, 'project', os);
		this.os = os;
		this.outputs = {};

		fs.mkdirpSync(this.proj_out);
	}

	add_module(pathname: string, isApp?: boolean, isFullname?: boolean): Package {
		let self = this;
		let source_path = resolveLocal(pathname);

		let json: PkgJson | null = null;
		let getPkg = ()=>{
			return json || (json = parse_json_file(source_path + '/package.json')) as PkgJson;
		};
		let outputName = isFullname ?
			getPkg().name + '@' + getPkg().version: path.basename(source_path);
		let pkg = self.outputs[outputName];
		if (!pkg) {
			pkg = new Package(self, source_path, outputName, getPkg(), isApp);
			self.outputs[outputName] = pkg;
			pkg.init();
		}
		return pkg;
	}

	private gen_item(proj_name: string) {
		let self = this;
		let gyp_exec = __dirname + (isWindows ? '/gyp.bat' : '/gyp.sh');

		let os = self.os;
		let source = self.source;
		let out = self.output;
		let style = 'make';
		let gen_out = path.relative(source, self.proj_out);
		let proj_path: string[];

		if (os == 'ios' || os == 'mac') {
			style = 'xcode';
			proj_path = [ `${gen_out}/${proj_name}.xcodeproj` ];
		}
		else if (os == 'android') {
			style = 'cmake-linux';
			proj_path = [ 'Release','Debug']
				.map(e=>`${out}/android/${proj_name}/out/${e}/CMakeLists.txt`);
			gen_out = path.relative(source, `${out}/android/${proj_name}`);
		}
		else if (os == 'linux') {
			style = 'make-linux';
			proj_path = [ `${self.proj_out}/mk` ];
			gen_out = `${gen_out}/mk`;
		}
		else {
			throw `Not Supported "${os}" export`;
		}

		// write _var.gypi
		let include_gypi = ' -Iout/var.gypi';
		let var_gyp = { variables: { OS: os, os, style, DEPTH: source } };
		fs.writeFileSync(`${source}/out/var.gypi`, JSON.stringify(var_gyp, null, 2));

		// console.log('paths.includes_gypi', source, paths.includes_gypi);

		paths.includes_gypi.forEach(function(str) {
			include_gypi += ' -I' + path.relative(source, str);
		});

		// console.log('paths.includes_gypi', paths.includes_gypi);

		let shell =
			`${gyp_exec} ` +
			`-f ${style} --generator-output="${gen_out}" ` +
			`-Goutput_dir="${path.relative(source, out)}" ` +
			`-Gstandalone ${include_gypi} ` +
			`${proj_name}.gyp ` +
			`--depth=. `
		;

		var log = syscall(shell);
		console.error(log.stderr.join('\n'));
		console.log(log.stdout.join('\n'));

		return proj_path;
	}

	private gen() {
		let self = this;
		let source = self.source;
		let includes = [] as string[];
		let pkgs = Object.values(self.outputs);

		for (let pkg of Object.values(self.outputs) ) {
			if (!pkg.is_app) {
				fs.writeFileSync( pkg.gypi_path, JSON.stringify(pkg.gen(), null, 2));
			}
		}

		for (let pkg of pkgs) { // gen app
			if (pkg.is_app) {
				includes.push(...pkg.includes, pkg.gypi_path);
				includes = filter_repeat(includes).map(function(pathname) {
					return path.relative(source, pathname);
				});
				fs.writeFileSync( pkg.gypi_path, JSON.stringify(pkg.gen(), null, 2));
			}
		}

		let quark_gyp = paths.quark_gyp;
		let gyp = 
		{
			'variables': {
				'libquark': [ quark_gyp ? path.relative(source, quark_gyp) + ':libquark': 'libquark' ],
			},
			'includes': includes,
		};

		let proj_name = this.package.outputName;
		let gyp_file = source + '/' + proj_name +'.gyp';

		// write gyp file
		fs.writeFileSync(gyp_file, JSON.stringify(gyp, null, 2));

		return self.gen_item(proj_name); // gen platform project
	}

	private gen_android_studio() {
		let self = this;
		let proj_out = self.proj_out;
		let out = this.gen();
		let str: string;
		let pkg = this.package;
		let name = pkg.outputName;
		let app_templ = `${__dirname}/export/android/app_template`;
		let proj_templ = `${__dirname}/export/android/proj_template`;

		// android并不完全依赖`gyp`, 还需生成 Android project
		{
			let id = (pkg.json.id || 'org.quark.' + name).replace(/-/gm, '_');
			let app_name = pkg.json.app || name;
			let version = pkg.json.version;
			let java_pkg = id.replace(/\./mg, '/');
			let so_pkg = pkg.native ? name : 'quark';
			let app = `${proj_out}/app`;

			// copy android project template
			fs.cp_sync(proj_templ, proj_out, { replace: false });
			// copy android app template
			fs.cp_sync(app_templ, app, { replace: false });
	
			fs.mkdirpSync(`${app}/src/main/assets`);
			fs.mkdirpSync(`${app}/src/main/java`);

			// MainActivity.java
			let start_argv = pkg.get_start_argv();
			let MainActivity_java = `${app}/src/main/java/${java_pkg}/MainActivity.java`;
			fs.cp_sync(`${__dirname}/export/android/MainActivity.java`, MainActivity_java, { replace: false });
			str = fs.readFileSync(MainActivity_java).toString('utf8');
			str = str.replace(/\{id\}/gm, id);
			str = str.replace(/String\s+LIBRARY\s+=\s+"[^\"]+"/, `String LIBRARY = "${so_pkg}"`);
			str = str.replace(/ARGV_DEBUG/, `"${start_argv[0]}"`);
			str = str.replace(/ARGV_DEBUG1/, `getPathInAssets("${start_argv[1]}")`);
			str = str.replace(/ARGV_RELEASE/, `getPathInAssets("${start_argv[2]}")`);
			fs.writeFileSync(MainActivity_java, str);

			// AndroidManifest.xml
			let AndroidManifest_xml = `${app}/src/main/AndroidManifest.xml`;
			str = fs.readFileSync(AndroidManifest_xml).toString('utf8');
			str = str.replace(/package\=\"[^\"]+\"/mg, `package="${id}"`);
			// <!meta-data android:name="android.app.lib_name" android:value="quark" />
			str = str.replace(/android\:name\=\"android\.app\.lib_name\"\s+android\:value\=\"[^\"]+\"/, 
												`android:name="android.app.lib_name" android:value="${so_pkg}"`);
			fs.writeFileSync(AndroidManifest_xml, str);

			// strings.xml
			let strings_xml = `${app}/src/main/res/values/strings.xml`;
			str = fs.readFileSync(strings_xml).toString('utf8');
			str = str.replace(/name\=\"app_name\"\>[^\<]+\</, `name="app_name">${app_name}<`);
			fs.writeFileSync(strings_xml, str);

			// build.gradle
			let build_gradle = `${app}/build.gradle.kts`;
			str = fs.readFileSync(build_gradle).toString('utf8');
			str = str.replace(/\{id\}/gm, id);
			str = str.replace(/namespace\s*=\s*('|")[^\'\"]+('|")/, `namespace = "${id}"`);
			str = str.replace(/applicationId\s*=\s*('|")[^\'\"]+('|")/, `applicationId = "${id}"`);
			if (version) str = str.replace(/versionName\s*=\s*('|")[^\'\"]+('|")/, `versionName = "${version}"`);

			//android.externalNativeBuild.cmake.path = file("CMakeLists.txt")
			str = str.replace(/^.*android\.externalNativeBuild\.cmake\..+$/mg, '');
			if (pkg.native) {
				let cmake = path.relative(`${app}`, out[0]);
				str += `\nandroid.externalNativeBuild.cmake.path = "${cmake}"`;
				str += `\nandroid.externalNativeBuild.cmake.version = "3.22.1"`;
			}
			fs.writeFileSync(build_gradle, str);

			if (pkg.native) {
				//对于android这两个属性会影响输出库.so的默认路径,导致无法捆绑.so库文件,所以从文件中删除它
				//set_target_properties(examples PROPERTIES LIBRARY_OUTPUT_DIRECTORY "${builddir}/pkg.${TOOLSET}")
				//set_source_files_properties(${builddir}/pkg.${TOOLSET}/pkgexamples.so PROPERTIES GENERATED "TRUE")
				let reg0 = /^set_target_properties\([^ ]+ PROPERTIES LIBRARY_OUTPUT_DIRECTORY [^\)]+\)/mg;
				let reg1 = /^set_source_files_properties\([^ ]+ PROPERTIES GENERATED "TRUE"\)/mg;
				for (let cmake of out) {
					str = fs.readFileSync(cmake).toString('utf8');
					str = str.replace(reg0, '').replace(reg1, '');
					fs.writeFileSync(cmake, str);
				}
			}

			// Copy pkgrary bundle resources to android assets directory
			// let output = self.output;
			// let android_assets = `${app}/src/main/assets`;
			// for (let res of pkg.bundle_resources) {
			// 	let basename = path.basename(res);
			// 	let source = path.relative(android_assets, output + '/' + res);
			// 	if (!fs.existsSync(output + '/' + res))
			// 		return;
			// 	let target = `${android_assets}/${basename}`;
			// 	try {
			// 		fs.unlinkSync(target);
			// 	} catch(e) {}
			// 	fs.symlinkSync(source, target); // create symlink
			// }
		}

		// write settings.gradle
		str = fs.readFileSync(`${proj_templ}/settings.gradle.kts`, 'utf-8');
		str += `\nrootProject.name = "${name}"`;
		str += `\ninclude(":app")`;
		fs.writeFileSync(`${proj_out}/settings.gradle.kts`, str);
	}

	async export(onlyOpen?: boolean) {
		const self = this;
		const os = self.os;

		// build apps
		if (!fs.existsSync(`${self.output}/all/package.json`)) {
			await (new Build(self.source, self.output).build());
		}

		const copy_to_usr = (source: string)=>{
			const target = `${self.output}/usr/${path.basename(source)}`;
			fs.copySync(source, target, { replace: true });
			return path.relative(self.output, target);
		};

		if (paths.librarys[os]) {
			paths.librarys[os].forEach(copy_to_usr);
			for (const it of paths.librarys[os]) {
				fs.chmod_r(`${self.output}/usr/${path.basename(it)}`, 0o755, ()=>{});
			}
		}
		paths.includes.forEach(copy_to_usr);

		// copy bundle resources and includes and librarys
		self.bundle_resources.push(...paths.bundle_resources.map(copy_to_usr));

		self.package = self.add_module(self.source, true);

		const name = self.package.outputName;
		const proj_out = this.proj_out;

		if (os == 'android') {
			if (!onlyOpen || !fs.existsSync(`${proj_out}/app`)) {
				self.gen_android_studio();
			}
			try {
				if (host_os == 'mac') {
					if (fs.existsSync('/Applications/Android Studio.app')) { // check is install 'Android Studio'
						execSync(`open -a "/Applications/Android Studio.app" ${proj_out}`);
					} else {
						execSync(`open ${proj_out}`); // open project
					}
				} else if (host_os == 'linux') {
					xdgOpen(proj_out);
				}
			} catch (e) {}
		}
		else if (os == 'linux') {
			if (!onlyOpen || !fs.existsSync(`${proj_out}/mk`)) {
				self.gen();
			}
			if (host_os != 'linux') {
				console.warn('Only compiling in Linux at Linux project');
			}
			try {
				if (host_os == 'mac') {
					execSync(`open ${proj_out}`); // open project
				} else if (host_os == 'linux') {
					xdgOpen(proj_out);
				}
			} catch (e) {}
		} else { // mac or ios ..
			let out = `${proj_out}/${name}.xcodeproj`;
			if (!onlyOpen || !fs.existsSync(out)) {
				self.gen();
			}
			try {
				if (host_os == 'mac') {
					execSync('open ' + out); // open project
				} else if (host_os == 'linux') {
					if (this.os == 'ios' || this.os == 'mac') {
						console.warn('Only opening in Macos at Xcode project');
					}
					xdgOpen(out);
				}
			} catch (e) {}
		}

		console.log(`export ${self.os} complete`);
	} // export()
}