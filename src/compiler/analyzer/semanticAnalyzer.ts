import { Token } from "../lexer/tokenizer";
import { FunctionNode } from "../types/astTypes";

export function analyzeComplexity(
    tokens: Token[],
    functions: FunctionNode[]
): FunctionNode[] {

    return functions.map(fn => {

        let complexity = 1;

        // Find function start index
        const startIndex = tokens.findIndex(
            t => t.line === fn.startLine && t.type === "FUNCTION"
        );

        if (startIndex === -1) {return fn;}

        // Find function body using { }
        let braceCount = 0;
        let i = startIndex;

        // Move to first {
        while (i < tokens.length && tokens[i].value !== "{") {
            i++;
        }

        if (i === tokens.length) {return fn;}

        braceCount++; // first {

        i++;

        // Traverse inside function body
        while (i < tokens.length && braceCount > 0) {

            const token = tokens[i];

            if (token.value === "{") {braceCount++;}
            if (token.value === "}") {braceCount--;}

            // Count decision points ONLY inside function
            if (
                token.type === "IF" ||
                token.type === "FOR" ||
                token.type === "WHILE"
            ) {
                complexity++;
            }

            i++;
        }

        return {
            ...fn,
            complexity
        };
    });
}