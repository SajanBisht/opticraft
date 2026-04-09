import * as vscode from 'vscode';
import { runMiniCompiler } from './compiler';
import { analyzeCode as babelAnalyze } from './babelFallback/babelAnalyzer';

export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand(
		'opticraft.optimizeComments',
		async () => {

			const editor = vscode.window.activeTextEditor;

			if (!editor) {
				vscode.window.showErrorMessage("Open a code file before running OptiCraft.");
				return;
			}

			const code = editor.document.getText();

			//  Run BOTH analyzers
			const miniResult = runMiniCompiler(code);
			const babelResult = babelAnalyze(code);

			const functionsMap = new Map<string, any>();

			//  Add Mini Compiler results
			if (miniResult.success) {
				console.log(" Using Mini Compiler (partial)");

				miniResult.functions.forEach(fn => {
					const key = fn.name + fn.startLine;
					functionsMap.set(key, { ...fn, source: "MC" });
				});
			}

			// Add Babel results (avoid duplicates)
			babelResult.forEach(fn => {
				const key = fn.name + fn.startLine;

				if (!functionsMap.has(key)) {
					functionsMap.set(key, { ...fn, source: "BABEL" });
				}
			});

			const functions = Array.from(functionsMap.values());

			console.log(" Final Merged Analysis:", functions);

			//  Sort bottom → top
			functions.sort((a, b) => b.startLine - a.startLine);

			await editor.edit(editBuilder => {

				functions.forEach(fn => {

					if (!fn.startLine || fn.startLine <= 0) return;

					const lineIndex = fn.startLine - 1;
					const prevLineIndex = lineIndex - 1;

					// duplicate detection (by function name)
					if (prevLineIndex >= 0) {
						const prevLineText = editor.document.lineAt(prevLineIndex).text;

						if (
							prevLineText.includes(fn.name) &&
							prevLineText.trim().startsWith("//")
						) {
							return;
						}
					}

					//  Complexity label
					let complexityLabel = "Low";
					if (fn.complexity > 5) complexityLabel = "Medium";
					if (fn.complexity > 10) complexityLabel = "High";

					const sourceTag = fn.source === "MC" ? "[MC]" : "[BABEL]";

					const comment =
						`// ${sourceTag} ${fn.name}() | Params: ${fn.params.length} | Complexity: ${fn.complexity} (${complexityLabel})`;

					const position = new vscode.Position(lineIndex, 0);

					editBuilder.insert(position, comment + "\n");
				});
			});

			vscode.window.showInformationMessage("OptiCraft: Comments optimized ");

		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() { }