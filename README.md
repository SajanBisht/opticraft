# OptiCraft 

##  Features

* Automatically generates meaningful comments for functions
* Uses AST parsing (Babel) to analyze complexity and structure
* Integrates with Gemini AI for intelligent explanations
* Skips invalid code and highlights issues

---

##  Installation (Local)

1. Download the `.vsix` file
2. Open VS Code
3. Go to Extensions
4. Click `...` → Install from VSIX
5. Select the file

---

## ▶ Usage

1. Open a JavaScript/TypeScript file
2. Press `Ctrl + Shift + P`
3. Search: **OptiCraft: Optimize Comments**
4. AI-generated comments will appear above functions

---

##  API Key Setup

1. Go to VS Code Settings
2. Search: `OptiCraft`
3. Enter your Gemini API key

---

##  How it works

* Parses code using Babel AST
* Extracts metadata (function name, complexity, structure)
* Sends metadata + code to Gemini AI
* Inserts clean comments above functions

---

##  Notes

* Requires internet connection for AI generation
* Free Gemini API supports ~1000 requests/day

---

##  Author

Sajan Bisht
Saurabh Parihar
Priyanshu Chand
