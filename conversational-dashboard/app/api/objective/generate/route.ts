import { NextResponse } from "next/server";
import OpenAI from "openai";
import { ObjectiveConfig } from "@/lib/objective/schema";
import { OBJECTIVE_MODEL } from "@/lib/llm/models";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SYSTEM_PROMPT = `
You are an Objective Function Author for a transaction database.

DATABASE SCHEMA:
- Table: transactions
- Columns: id, merchant_name, amount, category, created_at
- Sample merchants: Starbucks, Amazon, McDonalds, Uber, Netflix, Target

Current date: ${new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
})}

You MUST output a VALID JSON object with ALL required fields.

The Objective Function defines:
- WHAT the user wants
- WHAT must NEVER change during optimization
- HOW success is measured

===========================
REQUIRED JSON SCHEMA
===========================

{
  "intent": string,

  "scope": {
    "timeframe": {
      "type": "RELATIVE" | "ABSOLUTE",
      "value": string
    },
    "entity": {
      "type": string,
      "identifier"?: string | string[]
    },
    "filters"?: Array<{
      "field": "merchant_name" | "category",
      "value": string | string[]
    }>
  },

  "constraints": {
    "dataSource": "transactions",
    "mustInclude": []
  },
}

===========================
RULES
===========================
- intent MUST match the user's actual request - don't add complexity
- If no timeframe mentioned, use "RELATIVE" with value "all time"
- If specific merchant/category mentioned, extract it to entity.identifier
- For MIXED entity types (e.g., "coffee and uber" = category + merchant), use the filters array instead
- Each filter should specify the field (merchant_name or category) and value(s)
- Know that: Uber, Starbucks, Amazon, McDonalds, Netflix, Target = merchants (use merchant_name)
- Know that: Coffee, Food, Transport, Entertainment, Shopping, Groceries = categories (use category)
- dataSource should always be "transactions"
- mustInclude should be empty array unless specific columns requested
- Don't invent fiscal quarters or complex timeframes user didn't ask for
- Output ONLY valid JSON
- No markdown
- No explanations

EXAMPLES:

User: "expenses of Starbucks"
{
  "intent": "Get all Starbucks transaction expenses",
  "scope": {
    "timeframe": { "type": "RELATIVE", "value": "all time" },
    "entity": { "type": "merchant", "identifier": "Starbucks" }
  },
  "constraints": {
    "dataSource": "transactions",
    "mustInclude": []
  }
}

User: "total spending on coffee"
{
  "intent": "Calculate total spending on coffee category",
  "scope": {
    "timeframe": { "type": "RELATIVE", "value": "all time" },
    "entity": { "type": "category", "identifier": "Coffee" }
  },
  "constraints": {
    "dataSource": "transactions",
    "mustInclude": ["amount"]
  }
}

User: "coffee and uber expenses"
{
  "intent": "Get all coffee and Uber transaction expenses",
  "scope": {
    "timeframe": { "type": "RELATIVE", "value": "all time" },
    "entity": { "type": "mixed", "identifier": null },
    "filters": [
      { "field": "category", "value": "Coffee" },
      { "field": "merchant_name", "value": "Uber" }
    ]
  },
  "constraints": {
    "dataSource": "transactions",
    "mustInclude": []
  }
}
`;

export async function POST(req: Request) {
  const { userInput } = await req.json();

  const response = await openai.chat.completions.create({
    model: OBJECTIVE_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userInput },
    ],
  });

  function extractJson(text: string) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("No JSON object found in model response");
    }
    return JSON.parse(match[0]);
  }

  const raw = response.choices[0].message.content!;
  const objective = extractJson(raw) as ObjectiveConfig;

  // Fallback intent (defensive)
  if (!objective.intent || typeof objective.intent !== "string") {
    objective.intent =
      typeof userInput === "string" && userInput.trim()
        ? userInput.trim()
        : "(no intent provided)";
  }

  return NextResponse.json({ objective });
}
