import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * SQL Query Analyzer - Extracts execution metrics without running the actual query
 * Uses PostgreSQL EXPLAIN to analyze query execution plan
 */

export interface QueryAnalysis {
  estimatedRows: number;
  estimatedCost: number;
  fields: string[];
  executionPlan: string;
  usesIndex: boolean;
  hasAggregation: boolean;
}

/**
 * Analyze a SQL query using EXPLAIN
 */
export async function analyzeQuery(sql: string): Promise<QueryAnalysis> {
  try {
    // Get execution plan without running query
    const explainResult = await pool.query(`EXPLAIN (FORMAT JSON) ${sql}`);
    const plan = explainResult.rows[0]["QUERY PLAN"][0];

    // Extract estimated rows and cost
    const estimatedRows = plan.Plan?.["Plan Rows"] || 0;
    const estimatedCost = plan.Plan?.["Total Cost"] || 0;
    const usesIndex = JSON.stringify(plan).includes("Index Scan");

    // Get field names from the query structure
    const fields = extractFields(sql);

    // Check for aggregation
    const hasAggregation = /sum|avg|count|min|max|array_agg/i.test(sql);

    return {
      estimatedRows,
      estimatedCost,
      fields,
      executionPlan: JSON.stringify(plan, null, 2),
      usesIndex,
      hasAggregation,
    };
  } catch (error: any) {
    console.error("[Analyzer] Failed to analyze query:", error.message);

    // Fallback: return basic analysis from SQL parsing
    return {
      estimatedRows: 0,
      estimatedCost: 0,
      fields: extractFields(sql),
      executionPlan: "",
      usesIndex: false,
      hasAggregation: /sum|avg|count|min|max|array_agg/i.test(sql),
    };
  }
}

/**
 * Extract field names from SELECT clause
 */
function extractFields(sql: string): string[] {
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);

  if (!selectMatch) return [];

  const selectClause = selectMatch[1];

  // Split by comma and clean up
  const fields = selectClause
    .split(",")
    .map((field) => {
      // Extract alias if present (e.g., "name AS department_name" -> "department_name")
      const aliasMatch = field.match(/AS\s+(\w+)/i);
      if (aliasMatch) return aliasMatch[1].trim();

      // Otherwise get the column name
      const parts = field.trim().split(".");
      return parts[parts.length - 1].replace(/[()]/g, "").trim();
    })
    .filter((f) => f && f !== "*");

  return fields;
}

/**
 * Execute query and return actual row count and results
 */
export async function executeAndAnalyze(sql: string): Promise<{
  rowCount: number;
  fields: string[];
  executionTime: number;
  results: any[];
}> {
  const startTime = Date.now();

  try {
    const result = await pool.query(sql);
    const executionTime = Date.now() - startTime;

    const fields = result.rows.length > 0 ? Object.keys(result.rows[0]) : [];

    return {
      rowCount: result.rows.length,
      fields,
      executionTime,
      results: result.rows,
    };
  } catch (error: any) {
    console.error("[Analyzer] Query execution failed:", error.message);
    throw new Error(`Query execution failed: ${error.message}`);
  }
}
