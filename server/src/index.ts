import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ==========================
//  CACHE + CONTROL LAYER
// ==========================

// Cache store
const cache = new Map<string, string>();

// In-flight requests (avoid duplicate calls)
const inFlight = new Map<string, Promise<string>>();

// Queue to prevent burst calls
const queue: (() => Promise<void>)[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const task = queue.shift();
    if (task) await task();

    // small delay between requests (ANTI-429)
    await new Promise(res => setTimeout(res, 1200));
  }

  isProcessing = false;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    processQueue();
  });
}

// ==========================
// YOUR ORIGINAL LOGIC (UNCHANGED)
// ==========================

interface FunctionMeta {
  name: string;
  params: number;
  complexity: number;
  time: string;
  code?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateAIComment(data: FunctionMeta): Promise<string> {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

    if (!API_KEY) {
      console.warn("GEMINI_API_KEY not set in .env");
      return `// ${data.name} logic`;
    }

    let shortCode = data.code
      ?.split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, 15)
      .join("\n");

    if (!shortCode) shortCode = `function ${data.name}() {}`;

    const prompt = `You are a code documentation assistant.

Write a short code comment (max 2 lines) for this function.

Metadata (from static analysis):
- Function: ${data.name}
- Parameters: ${data.params}
- Cyclomatic complexity: ${data.complexity}
- Time complexity: ${data.time}

Actual function code:
${shortCode}

STRICT RULES:
- Output ONLY comment lines — nothing else, no explanation
- Every line MUST start with //
- Use action verbs: loops, sorts, merges, calculates, filters, returns, iterates
- Describe what the code ACTUALLY does based on the code above
- Do NOT say "performs operation", "handles logic", or "manages"
- Do NOT repeat the function name as the whole comment

Output:`;

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 800,
              thinkingConfig: {
                thinkingBudget: 512
              }
            }
          })
        }
      );

      if (response.status === 429 || response.status === 503) {
        const errorBody = await response.json().catch(() => ({}));
        const retryAfterMs = extractRetryDelay(errorBody) || (attempt * 10000);

        console.warn(
          `Gemini ${response.status} on attempt ${attempt}/${MAX_RETRIES}. Retrying in ${retryAfterMs / 1000}s...`
        );

        if (attempt < MAX_RETRIES) {
          await wait(retryAfterMs);
          continue;
        } else {
          return `// ${data.name} logic`;
        }
      }

      if (!response.ok) {
        return `// ${data.name} logic`;
      }

      const json = await response.json();

      const parts: any[] = json?.candidates?.[0]?.content?.parts || [];

      const textParts = parts
        .filter(p => !p.thought && typeof p.text === "string")
        .map(p => p.text.trim())
        .filter(t => t.length > 0);

      let text = textParts.join("\n").trim();

      if (!text) return `// ${data.name} logic`;

      const formatted = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.startsWith("//") ? line : `// ${line}`)
        .slice(0, 2)
        .join("\n");

      return formatted;
    }

    return `// ${data.name} logic`;

  } catch (err) {
    return `// ${data.name} logic`;
  }
}

function extractRetryDelay(errorBody: any): number | null {
  try {
    const details = errorBody?.error?.details || [];
    for (const detail of details) {
      if (detail?.retryDelay) {
        const seconds = parseFloat(detail.retryDelay.replace("s", ""));
        if (!isNaN(seconds)) return Math.ceil(seconds * 1000) + 1000;
      }
    }
  } catch {}
  return null;
}

// ==========================
// EXPRESS ROUTE (IMPROVED)
// ==========================

app.post("/generate-comment", async (req: Request, res: Response) => {
  try {
    const { code, metadata } = req.body;

    const key = JSON.stringify({ code, metadata });

    //  CACHE HIT
    if (cache.has(key)) {
      return res.json({ comment: cache.get(key) });
    }

    //  IN-FLIGHT REUSE
    if (inFlight.has(key)) {
      const result = await inFlight.get(key);
      return res.json({ comment: result });
    }

    //  QUEUED REQUEST
    const promise = enqueue(() =>
      generateAIComment({
        ...metadata,
        code
      })
    );

    inFlight.set(key, promise);

    const result = await promise;

    inFlight.delete(key);
    cache.set(key, result);

    res.json({ comment: result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ comment: "// Error generating comment" });
  }
});

// ==========================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});