import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Simple in-memory TTL cache shared per-process
const CACHE_TTL_MS = 30 * 1000; // 30s
const cache = new Map();
function getCached(key: string) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  return e.value;
}
function setCached(key: string, value: any) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function POST(req: Request) {
  try {
    const { userInput } = await req.json();

    if (!userInput || userInput.trim().length === 0) {
      return NextResponse.json([]);
    }

    const prompt = `
You are an SQL autocomplete engine.  
Generate **3 SQL suggestions** only.

Format your output EXACTLY as:

[
  { "description": "...", "sqlQuery": "..." },
  { "description": "...", "sqlQuery": "..." },
  { "description": "...", "sqlQuery": "..." }
]

RULES:
- No explanations outside JSON.
- No Markdown.
- Schema: transactions(id, merchant_name, amount, category, created_at)
User input: "${userInput}"
`;

    const cacheKey = `sql:${userInput}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    let text = completion.choices[0].message.content || "";

    text = text.replace(/```json|```sql|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse LLM output:", text);
      return NextResponse.json([]);
    }

    // Cache result
    setCached(cacheKey, parsed);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("SQL-Autocomplete ERROR:", err);
    return NextResponse.json([]);
  }
}
