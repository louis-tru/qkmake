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

function isExportKey(node: ts.Node): node is ts.DefaultKeyword | ts.ExportKeyword {
	return node.kind === ts.SyntaxKind.DefaultKeyword || node.kind === ts.SyntaxKind.ExportKeyword;
}

export default function injectAsyncWrapper(): ts.TransformerFactory<ts.SourceFile> {
	return (context) => {
		const { factory } = context;

		let isImport = false;

		function visit(node: ts.Node): ts.Node | ts.Node[] {
			// class async method
			if (ts.isMethodDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
				isImport = true;
				if (ts.isObjectLiteralExpression(node.parent)) { // object method
					// 把对象方法改成 addSearchPath: __wrapAsync(async function addSearchPath() {})
					return factory.createPropertyAssignment(
						node.name,
						factory.createCallExpression(
							factory.createIdentifier("__wrapAsync"),
							undefined,
							[
								factory.createFunctionExpression(
									node.modifiers.filter(e=>ts.isModifier(e)),
									node.asteriskToken,
									undefined,//node.name.getText(),
									node.typeParameters,
									node.parameters,
									node.type,
									node.body!
								)
							]
						)
					);
				} else { // class method
					// 给类方法添加 @__jscAsync 装饰器
					const decorator = factory.createDecorator(factory.createIdentifier("__jscAsync"));
					return factory.updateMethodDeclaration(
						node,
						factory.createNodeArray([...(node.modifiers ?? []), decorator]), // add decorator
						node.asteriskToken,
						node.name,
						node.questionToken,
						node.typeParameters,
						node.parameters,
						node.type,
						node.body
					);
				}
			}

			// top async function（function declaration）
			if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) && node.name) {
				isImport = true;
				const fnName = node.name.text;
				const funcExpr = factory.createFunctionExpression(
					node.modifiers?.filter(e=>!isExportKey(e) && ts.isModifier(e)) as ts.Modifier[],
					node.asteriskToken,
					void 0, // fnName,
					node.typeParameters,
					node.parameters,
					node.type,
					node.body!
				);
				const wrapperVar = factory.createVariableStatement(
					node.modifiers?.filter(e=>isExportKey(e)),
					factory.createVariableDeclarationList(
						[
							factory.createVariableDeclaration(
								fnName, void 0, void 0,
								factory.createCallExpression(factory.createIdentifier("__wrapAsync"), void 0, [funcExpr])
							)
						],
						ts.NodeFlags.Const
					)
				);
				return wrapperVar;
			}

			// ====== arrow function expression & function expression ======
			if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && 
					node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) 
			{
				isImport = true;
				return factory.createCallExpression(factory.createIdentifier("__wrapAsync"), void 0, [node]);
			}

			return ts.visitEachChild(node, visit, context);
		}

		return (sourceFile) => {
			isImport = false;
			let updated = ts.visitEachChild(sourceFile, visit, context);

			if (isImport) {
				const importDecl = factory.createImportDeclaration(
					undefined, // not decorators
					factory.createImportClause(
						false, // isTypeOnly = false
						undefined, // name (default import)
						// factory.createNamedImports([
						// 	factory.createImportSpecifier(false, void 0, factory.createIdentifier("__jscAsync")),
						// 	factory.createImportSpecifier(false, void 0, factory.createIdentifier("__wrapAsync")),
						// ]),
						factory.createNamespaceImport(factory.createIdentifier("_decorators_0"))
					),
					factory.createStringLiteral("quark/_decorators"),
					undefined // assertClause (TS 4.5+ optional)
				);

				const destructuredConst = factory.createVariableStatement(
					undefined,
					factory.createVariableDeclarationList(
						[
							factory.createVariableDeclaration(
								factory.createObjectBindingPattern([
									factory.createBindingElement(undefined, undefined, factory.createIdentifier("__wrapAsync"), undefined),
									factory.createBindingElement(undefined, undefined, factory.createIdentifier("__jscAsync"), undefined)
								]),
								undefined,
								undefined,
								factory.createIdentifier("_decorators_0")
							)
						],
						ts.NodeFlags.Const
					)
				);

				updated = factory.updateSourceFile(updated, [ importDecl, destructuredConst, ...updated.statements ]);
			}

			return updated;
		};
	};
}
