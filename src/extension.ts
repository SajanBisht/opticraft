import * as vscode from 'vscode';
import { runMiniCompiler } from './compiler';
import { analyzeCode as babelAnalyze } from './babelFallback/babelAnalyzer';
import { generateAIComment } from "./ai/aiService";

interface FunctionMeta {
    name: string;
    params: number;
    complexity: number;
    time: string;
}

async function createComment(meta: FunctionMeta, sourceTag: string): Promise<string> {
    const baseComment =
        `${sourceTag} ${meta.name}() | Params: ${meta.params} | Complexity: ${meta.complexity} | Time: ${meta.time}`;

    if (meta.complexity >= 4 || meta.time.includes("n")) {
        try {
            const aiText = await generateAIComment(meta);
            return `// ${baseComment}\n// [AI] ${aiText}`;
        } catch {
            return `// ${baseComment}`;
        }
    }

    return `// ${baseComment}`;
}

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

            const miniResult = runMiniCompiler(code);
            const babelResult = babelAnalyze(code);

            const functionsMap = new Map<string, any>();

            if (miniResult.success) {
                miniResult.functions.forEach(fn => {
                    const key = fn.name + fn.startLine;

                    functionsMap.set(key, {
                        ...fn,
                        source: "MC",
                        timeComplexity: "Unknown"
                    });
                });
            }

            babelResult.forEach(fn => {
                const key = fn.name + fn.startLine;

                if (functionsMap.has(key)) {
                    const existing = functionsMap.get(key);

                    functionsMap.set(key, {
                        ...existing,
                        timeComplexity: fn.timeComplexity || "O(1)"
                    });

                } else {
                    functionsMap.set(key, {
                        ...fn,
                        source: "BABEL",
                        timeComplexity: fn.timeComplexity || "O(1)"
                    });
                }
            });

            const functions = Array.from(functionsMap.values());

            functions.sort((a, b) => b.startLine - a.startLine);

            const edits: { position: vscode.Position; text: string }[] = [];

            for (const fn of functions) {

                if (!fn.startLine || fn.startLine <= 0) continue;

                const lineIndex = fn.startLine - 1;
                const prevLineIndex = lineIndex - 1;

                if (prevLineIndex >= 0) {
                    const prevLineText = editor.document.lineAt(prevLineIndex).text;

                    if (
                        prevLineText.includes(fn.name) &&
                        prevLineText.trim().startsWith("//")
                    ) {
                        continue;
                    }
                }

                let complexityLabel = "Low";
                if (fn.complexity > 5) complexityLabel = "Medium";
                if (fn.complexity > 10) complexityLabel = "High";

                const sourceTag = fn.source === "MC" ? "[MC]" : "[BABEL]";
                const time = fn.timeComplexity || "O(1)";

                const comment = await createComment(
                    {
                        name: fn.name,
                        params: fn.params?.length || 0,
                        complexity: fn.complexity,
                        time: `${time} (${complexityLabel})`
                    },
                    sourceTag
                );

                edits.push({
                    position: new vscode.Position(lineIndex, 0),
                    text: comment + "\n"
                });
            }

            await editor.edit(editBuilder => {
                edits.forEach(edit => {
                    editBuilder.insert(edit.position, edit.text);
                });
            });

            vscode.window.showInformationMessage("OptiCraft: Comments optimized");
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}