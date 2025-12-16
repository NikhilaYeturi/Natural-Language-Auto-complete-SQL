import { SQLState } from "./types";
import { ObjectiveConfig } from "@/lib/objective/schema";
import crypto from "crypto";

/**
 * Extract state representation from SQL query and objective
 */
export function extractState(
  sql: string,
  objective: ObjectiveConfig
): SQLState {
  const lower = sql.toLowerCase();

  return {
    selectColumns: extractSelectColumns(sql),
    wherePredicates: extractWherePredicates(sql),
    aggregations: extractAggregations(sql),
    hasGroupBy: lower.includes("group by"),
    hasOrderBy: lower.includes("order by"),
    constraintsMet: {
      timeframe: true, // Simplified for now
      entity: checkEntityConstraint(sql, objective),
      mustInclude: checkMustIncludeConstraint(sql, objective),
    },
    estimatedCost: estimateQueryCost(sql),
    objectiveHash: hashObjective(objective),
  };
}

/**
 * Generate state key for Q-table lookup
 */
export function stateKey(state: SQLState): string {
  return [
    state.selectColumns.sort().join(","),
    state.wherePredicates.sort().join(","),
    state.aggregations.sort().join(","),
    state.hasGroupBy ? "1" : "0",
    state.hasOrderBy ? "1" : "0",
    state.objectiveHash,
  ].join("||");
}

/**
 * Extract SELECT columns from SQL
 */
function extractSelectColumns(sql: string): string[] {
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
  if (!selectMatch) return [];

  const columnsStr = selectMatch[1].trim();
  if (columnsStr === "*") return ["*"];

  return columnsStr
    .split(",")
    .map((col) => col.trim().split(/\s+as\s+/i)[0].trim())
    .filter((col) => col.length > 0);
}

/**
 * Extract WHERE predicates from SQL
 */
function extractWherePredicates(sql: string): string[] {
  const whereMatch = sql.match(/WHERE\s+(.*?)(?:GROUP BY|ORDER BY|$)/i);
  if (!whereMatch) return [];

  const whereClause = whereMatch[1].trim();

  // Split by AND/OR but keep operators
  const predicates = whereClause
    .split(/\s+(AND|OR)\s+/i)
    .filter((p) => p.trim().length > 0 && !/(AND|OR)/i.test(p));

  return predicates.map((p) => p.trim());
}

/**
 * Extract aggregation functions from SQL
 */
function extractAggregations(sql: string): string[] {
  const aggFunctions = ["SUM", "COUNT", "AVG", "MAX", "MIN"];
  const aggregations: string[] = [];

  for (const func of aggFunctions) {
    const regex = new RegExp(`${func}\\s*\\([^)]+\\)`, "gi");
    const matches = sql.match(regex);
    if (matches) {
      aggregations.push(...matches.map((m) => m.toUpperCase()));
    }
  }

  return aggregations;
}

/**
 * Check if entity constraint is met
 */
function checkEntityConstraint(
  sql: string,
  objective: ObjectiveConfig
): boolean {
  const entity = objective?.scope?.entity;
  if (!entity || !entity.type) return true;

  const entityColumn = getEntityColumn(entity.type);
  const lower = sql.toLowerCase();

  return lower.includes(entityColumn.toLowerCase());
}

/**
 * Check if mustInclude constraint is met
 */
function checkMustIncludeConstraint(
  sql: string,
  objective: ObjectiveConfig
): boolean {
  const mustInclude = objective?.constraints?.mustInclude;
  if (!mustInclude || mustInclude.length === 0) return true;

  const lower = sql.toLowerCase();
  return mustInclude.every((field) => lower.includes(field.toLowerCase()));
}

/**
 * Map entity type to column name
 */
function getEntityColumn(entityType: string): string {
  const mapping: Record<string, string> = {
    merchant: "merchant_name",
    merchants: "merchant_name",
    category: "category",
  };

  return mapping[entityType.toLowerCase()] || entityType;
}

/**
 * Estimate query cost (simple heuristic)
 */
function estimateQueryCost(sql: string): number {
  let cost = 0;

  // Base cost
  cost += 10;

  // SELECT * penalty
  if (sql.includes("SELECT *")) cost += 20;

  // JOIN penalty (if we add joins later)
  const joinCount = (sql.match(/\sJOIN\s/gi) || []).length;
  cost += joinCount * 30;

  // WHERE clause bonus (filtering reduces cost)
  if (sql.match(/WHERE/i)) cost -= 5;

  // Aggregation cost
  const aggCount = extractAggregations(sql).length;
  cost += aggCount * 10;

  // GROUP BY cost
  if (sql.match(/GROUP BY/i)) cost += 15;

  return Math.max(0, cost);
}

/**
 * Hash ObjectiveConfig for state identification
 */
function hashObjective(objective: ObjectiveConfig): string {
  const simplified = {
    intent: objective.intent,
    entityType: objective.scope?.entity?.type,
    dataSource: objective.constraints?.dataSource,
  };

  return crypto
    .createHash("md5")
    .update(JSON.stringify(simplified))
    .digest("hex")
    .substring(0, 8);
}
