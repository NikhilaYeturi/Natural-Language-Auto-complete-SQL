import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Simple in-memory TTL cache shared per-process
const CACHE_TTL_MS = 30 * 1000; // 30s
const cache = new Map();
function getCached(key: string) { // get from cache with expiry check
  const e = cache.get(key); 
  if (!e) return null; // not in cache
  if (Date.now() > e.expiresAt) {
    cache.delete(key); // expired
    return null;
  }
  return e.value;
}
function setCached(key: string, value: any) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS }); // set with expiry
}

export async function POST(req: Request) {
  try {
    const { userInput } = await req.json(); // extract userInput from request body

    if (!userInput || userInput.trim().length === 0) { // handle empty input
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
// check cache
    const cacheKey = `sql:${userInput}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached); // return cached if exists

    const completion = await client.chat.completions.create({ // call OpenAI chat completion
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4, //temperature controls how random or deterministic the model's responses are
      //temp 0-2 is usual range but here we want low temp for more deterministic output
      //i didnt take max tokens to 1k to save cost since responses are short and itt will slow down the response time
    });

    let text = completion.choices[0].message.content || ""; // get the text response

    text = text.replace(/```json|```sql|```/g, "").trim(); // remove any code block markers

    let parsed; // try to parse JSON
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse LLM output:", text); // log the raw output for debugging
      return NextResponse.json([]);
    }

    // Cache result
    setCached(cacheKey, parsed);  // cache the parsed result

    return NextResponse.json(parsed); // return parsed result
  } catch (err) {
    console.error("SQL-Autocomplete ERROR:", err);
    return NextResponse.json([]); // return empty array on error
  }
}
