// src/index.ts

import fs from "fs";
import { saveASTToFile } from "./compiler/utils/astExporter";

const filePath = "C:/Users/LENOVO/test2.js";

// read file
const code = fs.readFileSync(filePath, "utf-8");

// generate AST
saveASTToFile(code);