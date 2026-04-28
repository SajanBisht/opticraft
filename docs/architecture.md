## activation 
step1->f5 
step2->ctl + shift +p
step3->choose your extention
step4->result shown


## flowchar
MC + Babel → metadata (name, complexity, time)
     +
extractFunctionCode() → actual code from editor
     ↓
generateAIComment() → Gemini 2.5 Flash-Lite (1000 req/day free)
     ↓
// Recursively sorts an array by dividing it into halves.
// Merges the sorted halves to produce a fully sorted array.



## flowchar  

MC/Babel
  → name, params, complexity, time (metadata)
      ↓
extractFunctionCode()
  → actual code from vscode editor
      ↓
createComment(meta, functionCode)
  → passes BOTH to generateAIComment()
      ↓
aiService prompt:
  "Metadata: name=mergeSort, complexity=2, time=O(log n)"
  "Code: mergeSort(arr) { ... actual code ... }"
      ↓
Gemini responds:
  "// Recursively splits array into halves and merges sorted results."
      ↓
Written to file — no [MC]/[BABEL] lines, only the // comment



## working
User runs OptiCraft
       ↓
validateCode() — Babel parses + traverses
       ↓
┌─────────────────────────────────────────────┐
│ Check 1: Syntax error?                      │
│   → Red underline on line 1                 │
│   → Stop entirely, show error message       │
├─────────────────────────────────────────────┤
│ Check 2: Undeclared loop vars?              │
│   for (i = 0; ...) → missing let/var       │
│   → Yellow underline on that for loop      │
│   → Skip that function for AI comments     │
├─────────────────────────────────────────────┤
│ Check 3: Call to undefined function?        │
│   merge() called but never defined         │
│   → Yellow underline on that call          │
│   → Skip that function for AI comments     │
└─────────────────────────────────────────────┘
       ↓
Valid functions → AI comments inserted
Invalid functions → underlined, skipped