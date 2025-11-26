import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

// FASTEST API
const client = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Cache for 30 sec
const CACHE_TTL_MS = 30000;
const cache = new Map();

const FILE = path.join(process.cwd(), "data", "userHistory.json");

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key: string, value: any) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function POST(req: Request) {
  const { userInput } = await req.json();

  if (!userInput || userInput.trim().length < 3) {
    return NextResponse.json([]);
  }

  // ---- Load user history ----
  let history: string[] = [];
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      if (Array.isArray(raw)) {
        history = raw.map((e: any) =>
          typeof e === "string" ? e : e.naturalText || ""
        ).filter(Boolean);
      }
    }
  } catch {}

  const cacheKey = "nl:" + userInput;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  // ----- PROMPT -----
  const prompt = `
You are an AI autocomplete engine.

User typed: "${userInput}"

User history:
${history.slice(-10).map((h, i) => `${i + 1}. ${h}`).join("\n")}

TASK:
Generate ONLY 4 autocomplete suggestions.

Output MUST be a JSON array:
[
  { "nlCompletion": "...", "sql": "..." },
  { "nlCompletion": "...", "sql": "..." },
  { "nlCompletion": "...", "sql": "..." },
  { "nlCompletion": "...", "sql": "..." }
]

Rules:
- SQL MUST follow this schema:
  transactions(id, merchant_name, amount, category, created_at)
- NO text outside JSON.
`;

  try {
    // ---- SUPER FAST ENDPOINT ----
    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      temperature: 0.2,
    });

    const text = resp.output_text.trim();

    let parsed = [];
    try {
      parsed = JSON.parse(
        text.replace(/```json|```/g, "")
      );
    } catch (err) {
      console.log("FAILED JSON:", text);
      parsed = [];
    }

    setCached(cacheKey, parsed);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("NL-Suggest ERROR:", err);
    return NextResponse.json([]);
  }
}
