export function estimateAdvancedComplexity(fnPath: any): string {
  let maxLoopDepth = 0;
  let hasDivision = false;
  let hasHalvingPattern = false;
  let recursionCalls = 0;
  let hasLinearWork = false;
  const functionName: string | undefined = fnPath.node.id?.name;

  const LINEAR_METHODS = new Set([
    "slice", "forEach", "map", "filter", "reduce",
    "concat", "indexOf", "includes", "flatMap", "fill",
  ]);

  function measureDepth(nodePath: any, depth: number) {
    maxLoopDepth = Math.max(maxLoopDepth, depth);
    nodePath.traverse({
      ForStatement(inner: any)     { measureDepth(inner, depth + 1); inner.skip(); },
      WhileStatement(inner: any)   { measureDepth(inner, depth + 1); inner.skip(); },
      DoWhileStatement(inner: any) { measureDepth(inner, depth + 1); inner.skip(); },
    });
  }

  fnPath.traverse({
    ForStatement(path: any)      { measureDepth(path, 1); path.skip(); },
    WhileStatement(path: any)    { measureDepth(path, 1); path.skip(); },
    DoWhileStatement(path: any)  { measureDepth(path, 1); path.skip(); },

    CallExpression(path: any) {
      const callee = path.node.callee;

      // Recursion detection
      if (callee.type === "Identifier" && callee.name === functionName) {
        recursionCalls++;
      }

      // Linear work detection
      if (callee.type === "MemberExpression") {
        const prop = callee.property?.name;
        if (LINEAR_METHODS.has(prop)) hasLinearWork = true;
        if (callee.object?.name === "Array" && prop === "from") hasLinearWork = true;
      }

      // new Array(n) implies O(n) allocation
      if (callee.type === "Identifier" && callee.name === "Array") hasLinearWork = true;
    },

    // Division / halving detection
    BinaryExpression(path: any) {
      if (path.node.operator === "/" || path.node.operator === ">>") {
        hasDivision = true;
      }
    },

    AssignmentExpression(path: any) {
      if (path.node.operator === "/=" || path.node.operator === ">>=") {
        hasDivision = true;
      }
    },

    VariableDeclarator(path: any) {
      const init = path.node.init;
      if (init?.type !== "CallExpression") return;
      const c = init.callee;

      // Math.floor / Math.ceil midpoint idiom
      if (
        c.type === "MemberExpression" &&
        c.object?.name === "Math" &&
        (c.property?.name === "floor" || c.property?.name === "ceil")
      ) {
        hasHalvingPattern = true;
      }

      // parseInt(x / 2) midpoint idiom
      if (c.type === "Identifier" && c.name === "parseInt") {
        hasHalvingPattern = true;
      }
    },
  });

  // --- Decision order: most specific → most general ---

  // Divide-and-conquer: recurse×2 + split + linear merge work (e.g. merge sort)
  if (recursionCalls >= 2 && hasDivision && hasLinearWork) return "O(n log n)";

  // Exponential recursion (e.g. fibonacci, naive subsets)
  if (recursionCalls >= 2) return "O(2^n)";

  // Recursive binary search
  if (recursionCalls === 1 && hasDivision) return "O(log n)";

  // Linear recursion
  if (recursionCalls === 1) return "O(n)";

  // Iterative halving / binary search (no recursion)
  if ((hasDivision || hasHalvingPattern) && maxLoopDepth <= 1) return "O(log n)";

  // Nested loops — generalised to O(n^k)
  if (maxLoopDepth >= 2) return `O(n^${maxLoopDepth})`;

  // Single loop
  if (maxLoopDepth === 1) return "O(n)";

  return "O(1)";
}