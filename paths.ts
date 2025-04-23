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

import * as fs from 'qktool/fs';
import * as path from 'path';

function resolve(name: string) {
	return path.resolve(__dirname, name);
}

export default {
	quark_gyp: '',
	includes_gypi: [ resolve('product/quark.gypi') ] as string[],
	default_modules: [] as string[],
	examples: resolve('product/examples'),
	types: resolve('product/@types'),
	bundle_resources: [] as string[],
	includes: [ resolve('product/include') ] as string[],
	librarys: {
		ios: [
			resolve('product/ios'),
		],
		mac: [
			resolve('product/mac'),
		],
		android: [
			resolve('product/android')
		],
		linux: [
			resolve('product/linux')
		],
	} as Dict<string[]>,
};

if ( !fs.existsSync(resolve('product/quark.gypi')) ) { // debug status
	exports.default = { 
		quark_gyp: __dirname + '/../../quark.gyp',
		includes_gypi: [
			__dirname + '/../../out/config.gypi',
			__dirname + '/../../tools/common.gypi',
		],
		default_modules: [],
		examples: __dirname + '/../../examples',
		types: __dirname + '/../../libs/quark/out/@types',
		bundle_resources: [ /*__dirname + '/../../quarkutil/cacert.pem'*/ ],
		includes: [],
		librarys: {},
	};
}