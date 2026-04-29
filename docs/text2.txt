import * as vscode from 'vscode';
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { runMiniCompiler } from './compiler';
import { analyzeCode as babelAnalyze } from './babelFallback/babelAnalyzer';
import { generateAIComment } from "./ai/aiService";

interface FunctionMeta {
    name: string;
    params: number;
    complexity: number;
    time: string;
    code?: string;
}

interface FunctionIssue {
    name: string;
    startLine: number;
    endLine: number;
    message: string;
}

// ─── Diagnostic collection (underlines) ───────────────────────────────────────
const diagnosticCollection = vscode.languages.createDiagnosticCollection("opticraft");

// ─── Extract full function body from editor ────────────────────────────────────
function extractFunctionCode(
    document: vscode.TextDocument,
    startLine: number
): string {
    const lines: string[] = [];
    let openBraces = 0;
    let started = false;

    for (let i = startLine - 1; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;

        if (text.includes("{")) {
            openBraces += (text.match(/{/g) || []).length;
            started = true;
        }
        if (text.includes("}")) {
            openBraces -= (text.match(/}/g) || []).length;
        }

        lines.push(text);
        if (started && openBraces === 0) break;
    }

    return lines.join("\n");
}

// ─── Validate code and return issues found ─────────────────────────────────────
// Uses Babel to detect:
//   1. Parse errors (syntax errors)
//   2. Undeclared variables used in loops (implicit globals like i, j, k)
//   3. Calls to functions/methods that don't exist in scope
function validateCode(code: string): {
    parseError: string | null;
    issues: FunctionIssue[];
} {
    // Step 1: Check if code parses at all
    let ast: any;
    try {
        ast = parse(code, {
            sourceType: "module",
            plugins: ["typescript", "jsx", "decorators-legacy"]
        });
    } catch (err: any) {
        return {
            parseError: err.message || "Syntax error",
            issues: []
        };
    }

    const issues: FunctionIssue[] = [];

    // Step 2: Traverse to find undeclared variable usage & missing references
    traverse(ast, {

        // Detect undeclared loop variables like: for (i = 0; ...)
        ForStatement(path: any) {
            const init = path.node.init;
            if (!init) return;

            // If init is an assignment expression (not VariableDeclaration), variable is undeclared
            if (t.isAssignmentExpression(init) || t.isSequenceExpression(init)) {
                const exprs = t.isSequenceExpression(init) ? init.expressions : [init];

                for (const expr of exprs) {
                    if (
                        t.isAssignmentExpression(expr) &&
                        t.isIdentifier(expr.left)
                    ) {
                        const varName = expr.left.name;
                        const binding = path.scope.getBinding(varName);

                        if (!binding) {
                            const fnPath = path.getFunctionParent();
                            const fnName = fnPath?.node?.id?.name ||
                                fnPath?.node?.key?.name ||
                                "anonymous";

                            const startLine = (path.node.loc?.start.line ?? 1) - 1;
                            const endLine = (path.node.loc?.end.line ?? 1) - 1;

                            issues.push({
                                name: fnName,
                                startLine,
                                endLine,
                                message: `Undeclared variable '${varName}' used in for loop. Add 'let' or 'var'.`
                            });
                        }
                    }
                }
            }
        },

        // Detect calls to identifiers that are not defined anywhere in scope
        CallExpression(path: any) {
            const callee = path.node.callee;

            // Only check simple function calls like merge(...), not this.merge(...)
            if (!t.isIdentifier(callee)) return;

            const name = callee.name;
            const binding = path.scope.getBinding(name);

            // Skip known globals
            const knownGlobals = new Set([
                "console", "Math", "JSON", "Object", "Array", "String",
                "Number", "Boolean", "Promise", "setTimeout", "setInterval",
                "clearTimeout", "clearInterval", "fetch", "require", "parseInt",
                "parseFloat", "isNaN", "isFinite", "encodeURIComponent",
                "decodeURIComponent", "Error", "Map", "Set", "Date"
            ]);

            if (knownGlobals.has(name)) return;
            if (binding) return; // it's declared somewhere — fine

            const fnPath = path.getFunctionParent();
            const fnName = fnPath?.node?.id?.name ||
                fnPath?.node?.key?.name ||
                "anonymous";

            const startLine = (path.node.loc?.start.line ?? 1) - 1;
            const endLine = (path.node.loc?.end.line ?? 1) - 1;

            issues.push({
                name: fnName,
                startLine,
                endLine,
                message: `Call to undefined function '${name}'. Make sure it is defined or imported.`
            });
        }
    });

    return { parseError: null, issues };
}

// ─── Apply underline diagnostics to editor ─────────────────────────────────────
function applyDiagnostics(
    document: vscode.TextDocument,
    parseError: string | null,
    issues: FunctionIssue[]
): void {
    const diagnostics: vscode.Diagnostic[] = [];

    if (parseError) {
        // Underline the whole first line on a parse error
        const range = new vscode.Range(0, 0, 0, document.lineAt(0).text.length);
        const diag = new vscode.Diagnostic(
            range,
            `OptiCraft: Syntax error — ${parseError}`,
            vscode.DiagnosticSeverity.Error
        );
        diag.source = "OptiCraft";
        diagnostics.push(diag);
    }

    for (const issue of issues) {
        const startLine = Math.min(issue.startLine, document.lineCount - 1);
        const endLine = Math.min(issue.endLine, document.lineCount - 1);
        const endChar = document.lineAt(endLine).text.length;

        const range = new vscode.Range(startLine, 0, endLine, endChar);
        const diag = new vscode.Diagnostic(
            range,
            `OptiCraft: ${issue.message}`,
            vscode.DiagnosticSeverity.Warning   // yellow underline
        );
        diag.source = "OptiCraft";
        diagnostics.push(diag);
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

// ─── Generate AI comment for one function ─────────────────────────────────────
async function createComment(
    meta: FunctionMeta,
    functionCode: string
): Promise<string> {
    try {
        const aiText = await generateAIComment({
            name: meta.name,
            params: meta.params,
            complexity: meta.complexity,
            time: meta.time,
            code: functionCode
        });

        if (!aiText || aiText.trim().length === 0) {
            return `// ${meta.name} logic`;
        }

        const formatted = aiText
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.startsWith("//") ? line : `// ${line}`)
            .join("\n");

        return formatted || `// ${meta.name} logic`;

    } catch {
        return `// ${meta.name} logic`;
    }
}

// ─── Extension activate ────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {

    // Register diagnostic collection so it cleans up on deactivate
    context.subscriptions.push(diagnosticCollection);

    const disposable = vscode.commands.registerCommand(
        'opticraft.optimizeComments',
        async () => {

            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showErrorMessage("Open a code file before running OptiCraft.");
                return;
            }

            // Only run on JS/TS files
            const lang = editor.document.languageId;
            if (!["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(lang)) {
                vscode.window.showWarningMessage("OptiCraft only works on JS/TS files.");
                return;
            }

            const document = editor.document;
            const code = document.getText();

            // ── Step 1: Validate code, collect issues ──────────────────────────
            const { parseError, issues } = validateCode(code);

            // Apply underlines regardless — so user sees warnings even for partial runs
            applyDiagnostics(document, parseError, issues);

            // If entire file has a syntax error, stop — nothing can be analyzed
            if (parseError) {
                vscode.window.showErrorMessage(
                    `OptiCraft: File has a syntax error. Fix it before optimizing comments.`
                );
                return;
            }

            // Build a set of function names that have issues — skip these for AI comments
            const problematicFunctions = new Set(issues.map(i => i.name));

            if (issues.length > 0) {
                vscode.window.showWarningMessage(
                    `OptiCraft: ${issues.length} issue(s) found (see underlines). ` +
                    `Skipping affected functions, commenting the rest.`
                );
            }

            // ── Step 2: Run analyzers ──────────────────────────────────────────
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

                // ── Step 3: Skip functions with detected issues ────────────────
                if (problematicFunctions.has(fn.name)) {
                    console.log(`OptiCraft: Skipping "${fn.name}" — has code issues.`);
                    continue;
                }

                const lineIndex = fn.startLine - 1;
                const prevLineIndex = lineIndex - 1;

                // Skip if already commented
                if (prevLineIndex >= 0) {
                    const prevLineText = document.lineAt(prevLineIndex).text;
                    if (
                        prevLineText.includes(fn.name) &&
                        prevLineText.trim().startsWith("//")
                    ) {
                        continue;
                    }
                }

                const functionCode = extractFunctionCode(document, fn.startLine);

                let complexityLabel = "Low";
                if (fn.complexity > 5) complexityLabel = "Medium";
                if (fn.complexity > 10) complexityLabel = "High";

                const time = fn.timeComplexity || "O(1)";

                const comment = await createComment(
                    {
                        name: fn.name,
                        params: fn.params?.length || 0,
                        complexity: fn.complexity,
                        time: `${time} (${complexityLabel})`
                    },
                    functionCode
                );

                edits.push({
                    position: new vscode.Position(lineIndex, 0),
                    text: comment + "\n"
                });
            }

            if (edits.length === 0) {
                vscode.window.showInformationMessage(
                    "OptiCraft: No valid functions found to comment."
                );
                return;
            }

            await editor.edit(editBuilder => {
                edits.forEach(edit => {
                    editBuilder.insert(edit.position, edit.text);
                });
            });

            vscode.window.showInformationMessage(
                `OptiCraft: Comments optimized  (${edits.length} function(s) commented)`
            );
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {
    diagnosticCollection.clear();
    diagnosticCollection.dispose();
}