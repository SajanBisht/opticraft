import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

export interface FunctionInfo {
    name: string;
    params: string[];
    startLine: number;
    complexity: number;
}

export function analyzeCode(code: string): FunctionInfo[] {

    const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx", "decorators-legacy"]
    });

    const functions: FunctionInfo[] = [];

    // Helper to safely extract param names
    function getParamName(param: t.Node): string {
        if (t.isIdentifier(param)) return param.name;
        if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
            return param.left.name;
        }
        return "param";
    }

    function calculateComplexity(path: any): number {
        let complexity = 1;

        path.traverse({
            IfStatement() { complexity++; },
            ForStatement() { complexity++; },
            WhileStatement() { complexity++; },
            DoWhileStatement() { complexity++; },
            SwitchCase() { complexity++; },
            CatchClause() { complexity++; },

            LogicalExpression(innerPath: any) {
                if (
                    innerPath.node.operator === "&&" ||
                    innerPath.node.operator === "||"
                ) {
                    complexity++;
                }
            },

            ConditionalExpression() { // ternary
                complexity++;
            }
        });

        return complexity;
    }

    traverse(ast, {

        // =========================
        // FUNCTION DECLARATION
        // =========================
        FunctionDeclaration(path: any) {
            const name = path.node.id?.name || "anonymous";
            const params = path.node.params.map(getParamName);
            const startLine = path.node.loc?.start.line || 0;
            const complexity = calculateComplexity(path);

            functions.push({ name, params, startLine, complexity });
        },

        // =========================
        // FUNCTION EXPRESSION
        // =========================
        FunctionExpression(path: any) {
            let name = "anonymous";

            if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
                name = path.parent.id.name;
            }

            const params = path.node.params.map(getParamName);
            const startLine = path.node.loc?.start.line || 0;
            const complexity = calculateComplexity(path);

            functions.push({ name, params, startLine, complexity });
        },

        // =========================
        // ARROW FUNCTION
        // =========================
        ArrowFunctionExpression(path: any) {
            let name = "anonymous";

            if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
                name = path.parent.id.name;
            }

            const params = path.node.params.map(getParamName);
            const startLine = path.node.loc?.start.line || 0;
            const complexity = calculateComplexity(path);

            functions.push({ name, params, startLine, complexity });
        },

        // =========================
        // CLASS METHODS (incl async)
        // =========================
        ClassMethod(path: any) {
            const name = path.node.key?.name || "method";
            const params = path.node.params.map(getParamName);
            const startLine = path.node.loc?.start.line || 0;
            const complexity = calculateComplexity(path);

            functions.push({ name, params, startLine, complexity });
        },

        // =========================
        // CLASS PROPERTY (arrow in class)
        // =========================
        ClassProperty(path: any) {
            if (t.isArrowFunctionExpression(path.node.value)) {
                const name = path.node.key?.name || "propFn";
                const params = path.node.value.params.map(getParamName);
                const startLine = path.node.loc?.start.line || 0;
                const complexity = calculateComplexity(path);

                functions.push({ name, params, startLine, complexity });
            }
        },

        // =========================
        // OBJECT METHODS
        // =========================
        ObjectMethod(path: any) {
            const name = path.node.key?.name || "method";
            const params = path.node.params.map(getParamName);
            const startLine = path.node.loc?.start.line || 0;
            const complexity = calculateComplexity(path);

            functions.push({ name, params, startLine, complexity });
        },

        // =========================
        // OBJECT PROPERTY FUNCTION
        // =========================
        ObjectProperty(path: any) {
            if (t.isFunctionExpression(path.node.value) || t.isArrowFunctionExpression(path.node.value)) {
                const name = path.node.key?.name || "propFn";
                const params = path.node.value.params.map(getParamName);
                const startLine = path.node.loc?.start.line || 0;
                const complexity = calculateComplexity(path);

                functions.push({ name, params, startLine, complexity });
            }
        }

    });

    return functions;
}