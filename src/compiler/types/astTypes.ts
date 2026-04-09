export interface FunctionNode {
    type: "FunctionDeclaration";
    name: string;
    params: string[];
    startLine: number;
    complexity: number;
}

export type ASTNode = FunctionNode;