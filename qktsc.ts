#!/usr/bin/env node
/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2015, Louis.chu
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Louis.chu nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL Louis.chu BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * 
 * ***** END LICENSE BLOCK ***** */

import * as ts from "typescript";
import * as path from "path";
import * as args from 'qktool/arguments';

// 配置路径
const tsconfigPath = path.resolve(args.options.project || 'tsconfig.json');
const no_transformer = args.options.no_transformer || 0;

delete args.options.project;
delete args.options.no_transformer;

// 读取 tsconfig.json
const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
if (configFile.error) {
	console.error(ts.formatDiagnosticsWithColorAndContext([configFile.error], {
		getCurrentDirectory: ts.sys.getCurrentDirectory,
		getCanonicalFileName: f => f,
		getNewLine: () => ts.sys.newLine
	}));
	process.exit(1);
}

const config = configFile.config || {};
config.compilerOptions = { ...config.compilerOptions, ...args.options };

// 解析配置
const parsedConfig = ts.parseJsonConfigFileContent(
	config,
	ts.sys,
	path.dirname(tsconfigPath)
);

const rootDir = parsedConfig.options.rootDir!;
const compilerOptions = parsedConfig.options;
const files = parsedConfig.fileNames;

// 创建 Program
const program = ts.createProgram({
	rootNames: files,
	options: compilerOptions,
});

// 获取诊断信息
const syntacticDiagnostics = program.getSyntacticDiagnostics();
const semanticDiagnostics = program.getSemanticDiagnostics();
const optionsDiagnostics = program.getOptionsDiagnostics();

// 合并所有诊断
const allDiagnostics = [ ...syntacticDiagnostics, ...semanticDiagnostics, ...optionsDiagnostics ];

// 输出诊断
if (allDiagnostics.length > 0) {
	console.log("TypeScript Diagnostics:");
	allDiagnostics.forEach((d) => {
		const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
		if (d.file) {
			const { line, character } = d.file.getLineAndCharacterOfPosition(d.start!);
			console.log(`${path.relative(rootDir, d.file.fileName)} (${line + 1},${character + 1}): ${msg}`);
		} else {
			console.log(msg);
		}
	});
	process.exit(1);
}

// 引入 Transformer
import transformer from "./inject_async_wrapper";

// Emit
const {emitSkipped,diagnostics} = program.emit(
	void 0,
	void 0,
	void 0,
	false,
	no_transformer ? void 0: { before: [transformer()] }
);

// if (emitSkipped) {
	// console.error("TypeScript compilation failed!");
	// process.exit(1);
// } else {
console.log("Compilation succeeded, output to", compilerOptions.outDir);
// }
