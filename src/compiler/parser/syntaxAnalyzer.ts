import { Token } from "../lexer/tokenizer";
import { FunctionNode } from "../types/astTypes";

export function parse(tokens: Token[]): FunctionNode[] {
    const functions: FunctionNode[] = [];

    for (let i = 0; i < tokens.length; i++) {

        // =========================
        // FUNCTION DECLARATION
        // =========================
        if (tokens[i].type === "FUNCTION") {

            const nameToken = tokens[i + 1];
            const openParen = tokens[i + 2];

            if (!nameToken || nameToken.type !== "IDENTIFIER") {continue;}
            if (!openParen || openParen.value !== "(") {continue;}

            const name = nameToken.value;
            const params: string[] = [];

            let j = i + 3;

            while (tokens[j] && tokens[j].value !== ")") {
                if (tokens[j].type === "IDENTIFIER") {
                    params.push(tokens[j].value);
                }
                j++;
            }

            functions.push({
                type: "FunctionDeclaration",
                name,
                params,
                startLine: tokens[i].line,
                complexity: 1
            });
        }

        // =========================
        // ARROW FUNCTION
        // =========================
        if (
            tokens[i].type === "IDENTIFIER" &&
            tokens[i + 1]?.value === "="
        ) {
            const name = tokens[i].value;

            let j = i + 2;
            const params: string[] = [];

            // case: (a,b) =>
            if (tokens[j]?.value === "(") {
                j++;

                while (tokens[j] && tokens[j].value !== ")") {
                    if (tokens[j].type === "IDENTIFIER") {
                        params.push(tokens[j].value);
                    }
                    j++;
                }

                j++; // skip ")"
            }

            // case: a => ...
            else if (tokens[j]?.type === "IDENTIFIER") {
                params.push(tokens[j].value);
                j++;
            }

            // check arrow =>
            if (tokens[j]?.type === "ARROW") {

                functions.push({
                    type: "FunctionDeclaration",
                    name,
                    params,
                    startLine: tokens[i].line,
                    complexity: 1
                });
            }
        }
    }

    return functions;
}