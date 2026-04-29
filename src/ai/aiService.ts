import * as vscode from "vscode";
import * as crypto from "crypto";

// ─── Your deployed Render backend ────────────────────────────────────────────
const BACKEND_URL = "https://opticraft-server.onrender.com/generate-comment";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FunctionMeta {
    name: string;
    params: number;
    complexity: number;
    time: string;
    code?: string;
}

// ─── Cache (VS Code globalState — persists across sessions) ───────────────────
const CACHE_KEY = "opticraft.commentCache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
    comment: string;
    timestamp: number;
}

type CacheStore = Record<string, CacheEntry>;

function hashCode(code: string): string {
    const normalised = code
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join("\n");
    return crypto.createHash("sha1").update(normalised).digest("hex");
}

function loadCache(context: vscode.ExtensionContext): CacheStore {
    return context.globalState.get<CacheStore>(CACHE_KEY) || {};
}

async function saveCache(context: vscode.ExtensionContext, store: CacheStore): Promise<void> {
    await context.globalState.update(CACHE_KEY, store);
}

function getCached(store: CacheStore, hash: string): string | null {
    const entry = store[hash];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.comment;
}

function evictExpired(store: CacheStore): void {
    const now = Date.now();
    for (const key of Object.keys(store)) {
        if (now - store[key].timestamp > CACHE_TTL_MS) delete store[key];
    }
}

// ─── Main function — calls Render backend, caches result ─────────────────────
export async function generateAIComment(
    data: FunctionMeta,
    context?: vscode.ExtensionContext
): Promise<string> {
    try {
        // Trim code to first 15 non-empty lines
        let shortCode = data.code
            ?.split("\n")
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .slice(0, 15)
            .join("\n");

        if (!shortCode) shortCode = `function ${data.name}() {}`;

        // ── Cache lookup ──────────────────────────────────────────────────────
        const hash = hashCode(shortCode);

        if (context) {
            const store = loadCache(context);
            const cached = getCached(store, hash);

            if (cached) {
                console.log(`OptiCraft cache HIT for "${data.name}" (${hash.slice(0, 8)})`);
                return cached;
            }

            console.log(`OptiCraft cache MISS for "${data.name}" — calling backend`);
        }

        // ── Call Render backend ───────────────────────────────────────────────
        // No API key needed here — backend holds the key securely on Render
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code: shortCode,
                metadata: {
                    name: data.name,
                    params: data.params,
                    complexity: data.complexity,
                    time: data.time
                }
            })
        });

        if (!response.ok) {
            console.error(`Backend error [${response.status}]: ${await response.text()}`);
            return `// ${data.name} logic`;
        }

        const json = await response.json();
        let comment: string = json?.comment || "";

        if (!comment || comment.trim().length === 0) {
            console.warn(`Backend returned empty comment for "${data.name}"`);
            return `// ${data.name} logic`;
        }

        // Ensure every line starts with //
        comment = comment
            .split("\n")
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
            .map((line: string) => line.startsWith("//") ? line : `// ${line}`)
            .slice(0, 2)
            .join("\n");

        // ── Save to cache ─────────────────────────────────────────────────────
        if (context) {
            const store = loadCache(context);
            evictExpired(store);
            store[hash] = { comment, timestamp: Date.now() };
            await saveCache(context, store);
            console.log(`OptiCraft cache SET for "${data.name}" (${hash.slice(0, 8)})`);
        }

        return comment;

    } catch (err) {
        console.error("Error calling OptiCraft backend:", err);
        return `// ${data.name} logic`;
    }
}

// ─── Cache utilities ──────────────────────────────────────────────────────────
export async function clearCommentCache(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(CACHE_KEY, {});
    console.log("OptiCraft: comment cache cleared");
}

export function getCacheStats(context: vscode.ExtensionContext): { total: number; expired: number } {
    const store = loadCache(context);
    const now = Date.now();
    const keys = Object.keys(store);
    const expired = keys.filter(k => now - store[k].timestamp > CACHE_TTL_MS).length;
    return { total: keys.length, expired };
}