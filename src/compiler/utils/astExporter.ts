import { parse } from "@babel/parser";
import fs from "fs";

export function saveASTToFile(code: string) {
    const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx", "decorators-legacy"]
    });

    fs.writeFileSync(
        "ast-output.json",
        JSON.stringify(ast, null, 2)
    );

    console.log("AST saved successfully");
}