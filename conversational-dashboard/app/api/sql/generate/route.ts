import { NextRequest, NextResponse } from "next/server";
import { introspectSchema } from "@/lib/schema/introspect";
import OpenAI from "openai";
import { OBJECTIVE_MODEL } from "@/lib/llm/models";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Basic text-to-SQL generator (no RL optimization)
 * Fast, simple SQL generation from natural language
 */
export async function POST(req: NextRequest) {
  try {
    const { objective } = await req.json();

    if (!objective) {
      return NextResponse.json(
        { error: "Missing objective" },
        { status: 400 }
      );
    }

    console.log("[Text2SQL] Generating SQL from objective...");

    // Get live database schema
    const schema = await introspectSchema();

    // Build schema description
    const schemaDescription = schema.tables
      .map((table) => {
        const cols = table.columns.map(c => `${c.name} (${c.type})`).join(", ");
        return `- Table: ${table.name}\n  Columns: ${cols}`;
      })
      .join("\n\n");

    const relationshipsDescription = schema.relationships
      .map(rel => `- ${rel.from} -> ${rel.to}`)
      .join("\n");

    const prompt = `You are a PostgreSQL expert. Generate a SQL query based on the user's request.

OBJECTIVE:
${JSON.stringify(objective, null, 2)}

DATABASE SCHEMA:
${schemaDescription}

${schema.relationships.length > 0 ? `FOREIGN KEY RELATIONSHIPS:\n${relationshipsDescription}` : ""}

INSTRUCTIONS:
1. Analyze the objective to understand what data is requested
2. Identify which tables need to be joined based on relationships
3. Use proper JOIN syntax with table aliases
4. Apply filters from objective.scope.filters
5. Select columns from objective.constraints.mustInclude
6. Return ONLY the SQL query, no explanations

Generate a valid PostgreSQL query:`;

    const response = await openai.chat.completions.create({
      model: OBJECTIVE_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: "You are a PostgreSQL expert. Return ONLY valid SQL queries." },
        { role: "user", content: prompt },
      ],
    });

    let sql = response.choices[0]?.message?.content?.trim();

    if (!sql) {
      throw new Error("Failed to generate SQL");
    }

    // Clean up markdown formatting
    sql = sql
      .replace(/```sql\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    console.log("[Text2SQL] Generated SQL:", sql);

    return NextResponse.json({ sql });

  } catch (error: any) {
    console.error("[Text2SQL Error]:", error.message);
    return NextResponse.json(
      { error: "Failed to generate SQL", details: error.message },
      { status: 500 }
    );
  }
}
