import { tokenize } from "./lexer/tokenizer";
import { parse } from "./parser/syntaxAnalyzer";
import { analyzeComplexity } from "./analyzer/semanticAnalyzer";

export interface CompilerResult {
    success: boolean;
    functions: any[];
    tokens?: any[];
    error?: string;
}

export function runMiniCompiler(code: string): CompilerResult {
    try {
        const tokens = tokenize(code);

        if (!tokens || tokens.length === 0) {
            return {
                success: false,
                functions: [],
                error: "Tokenization failed"
            };
        }

        const functions = parse(tokens);

        if (!functions || functions.length === 0) {
            return {
                success: false,
                functions: [],
                tokens,
                error: "Parsing failed"
            };
        }

        const analyzed = analyzeComplexity(tokens, functions);

        return {
            success: true,
            functions: analyzed,
            tokens
        };

    } catch (error: any) {
        console.error("Mini compiler failed:", error);

        return {
            success: false,
            functions: [],
            error: error.message
        };
    }
}