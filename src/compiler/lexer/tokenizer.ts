export type Token = {
    type: string;
    value: string;
    line: number;
    column: number;
};

export function tokenize(code: string): Token[] {
    const tokens: Token[] = [];

    const regex =
        /\bfunction\b|\breturn\b|\bif\b|\bfor\b|\bwhile\b|=>|==|!=|<=|>=|[a-zA-Z_]\w*|\d+|"[^"]*"|'[^']*'|\(|\)|\{|\}|,|;|=|\+|\-|\*|\/|<|>/g;

    let match;
    let line = 1;

    while ((match = regex.exec(code)) !== null) {
        const value = match[0];

        // Calculate column
        const before = code.slice(0, match.index);
        line = before.split("\n").length;
        const column = match.index - before.lastIndexOf("\n");

        let type = "UNKNOWN";

        if (value === "function") type = "FUNCTION";
        else if (value === "return") type = "RETURN";
        else if (value === "if") type = "IF";
        else if (value === "for") type = "FOR";
        else if (value === "while") type = "WHILE";
        else if (value === "=>") type = "ARROW";
        else if (/^".*"$|^'.*'$/.test(value)) type = "STRING";
        else if (/^\d+$/.test(value)) type = "NUMBER";
        else if (/^[a-zA-Z_]\w*$/.test(value)) type = "IDENTIFIER";
        else type = "SYMBOL";

        tokens.push({
            type,
            value,
            line,
            column
        });
    }

    return tokens;
}