import { SQLAction, Action } from "./types";
import { ObjectiveConfig } from "@/lib/objective/schema";

/**
 * Apply an action to SQL query
 */
export function applyAction(
  sql: string,
  action: Action,
  objective: ObjectiveConfig
): string {
  switch (action.type) {
    case SQLAction.ADD_COLUMN:
      return addColumn(sql, action.params?.column);

    case SQLAction.REMOVE_COLUMN:
      return removeColumn(sql, action.params?.column);

    case SQLAction.ADD_WHERE_CLAUSE:
      return addWhereClause(sql, action.params?.predicate);

    case SQLAction.MODIFY_WHERE_OPERATOR:
      return modifyWhereOperator(sql);

    case SQLAction.REMOVE_WHERE_CLAUSE:
      return removeWhereClause(sql, action.params?.predicate);

    case SQLAction.ADD_AGGREGATION:
      return addAggregation(sql, action.params?.func, action.params?.column);

    case SQLAction.REMOVE_AGGREGATION:
      return removeAggregation(sql);

    case SQLAction.ADD_ORDER_BY:
      return addOrderBy(sql, action.params?.column);

    case SQLAction.FIX_ENTITY_COLUMN:
      return fixEntityColumn(sql, objective);

    case SQLAction.NO_OP:
      return sql;

    default:
      return sql;
  }
}

/**
 * Get applicable actions for current SQL state
 */
export function getApplicableActions(
  sql: string,
  objective: ObjectiveConfig
): SQLAction[] {
  const applicable: SQLAction[] = [];

  // Always can use LLM policy
  applicable.push(SQLAction.USE_LLM_POLICY);

  // Can add column if not selecting all columns
  if (!sql.includes("SELECT *")) {
    applicable.push(SQLAction.ADD_COLUMN);
  }

  // Can remove column if selecting specific columns
  if (sql.match(/SELECT\s+[\w,\s]+\s+FROM/i) && !sql.includes("SELECT *")) {
    applicable.push(SQLAction.REMOVE_COLUMN);
  }

  // Can add WHERE if no WHERE exists
  if (!sql.match(/WHERE/i)) {
    applicable.push(SQLAction.ADD_WHERE_CLAUSE);
  }

  // Can modify WHERE operator if WHERE exists with =
  if (sql.match(/WHERE.*=/i)) {
    applicable.push(SQLAction.MODIFY_WHERE_OPERATOR);
  }

  // Can fix entity column if entity constraint exists
  const entity = objective?.scope?.entity;
  if (entity && entity.type) {
    applicable.push(SQLAction.FIX_ENTITY_COLUMN);
  }

  // Can add aggregation if no aggregation exists
  if (!sql.match(/(SUM|COUNT|AVG|MAX|MIN)\s*\(/i)) {
    applicable.push(SQLAction.ADD_AGGREGATION);
  }

  // Can remove aggregation if aggregation exists
  if (sql.match(/(SUM|COUNT|AVG|MAX|MIN)\s*\(/i)) {
    applicable.push(SQLAction.REMOVE_AGGREGATION);
  }

  // Can add ORDER BY if no ORDER BY exists
  if (!sql.match(/ORDER BY/i)) {
    applicable.push(SQLAction.ADD_ORDER_BY);
  }

  return applicable;
}

// ========================================
// SQL Transformation Functions
// ========================================

/**
 * Add a column to SELECT clause
 */
function addColumn(sql: string, column?: string): string {
  const col = column || "amount"; // Default to amount

  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
  if (!selectMatch) return sql;

  const currentColumns = selectMatch[1].trim();
  if (currentColumns === "*") {
    // Replace * with specific columns
    return sql.replace(/SELECT\s+\*\s+FROM/i, `SELECT id, ${col} FROM`);
  }

  // Add column to existing list
  const newColumns = `${currentColumns}, ${col}`;
  return sql.replace(/SELECT\s+(.*?)\s+FROM/i, `SELECT ${newColumns} FROM`);
}

/**
 * Remove a column from SELECT clause
 */
function removeColumn(sql: string, column?: string): string {
  if (sql.includes("SELECT *")) return sql; // Can't remove from *

  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
  if (!selectMatch) return sql;

  const columns = selectMatch[1]
    .split(",")
    .map((c) => c.trim())
    .filter((c) => {
      if (!column) return false; // Remove first column if no specific column
      return !c.toLowerCase().includes(column.toLowerCase());
    });

  if (columns.length === 0) {
    return sql.replace(/SELECT\s+(.*?)\s+FROM/i, "SELECT * FROM");
  }

  return sql.replace(/SELECT\s+(.*?)\s+FROM/i, `SELECT ${columns.join(", ")} FROM`);
}

/**
 * Add a WHERE clause
 */
function addWhereClause(sql: string, predicate?: string): string {
  if (sql.match(/WHERE/i)) return sql; // Already has WHERE

  const pred = predicate || "amount > 0";

  // Find FROM clause and insert WHERE after it
  return sql.replace(/FROM\s+(\w+)/i, `FROM $1 WHERE ${pred}`);
}

/**
 * Modify WHERE operator from = to IN for multiple values
 */
function modifyWhereOperator(sql: string): string {
  // Find WHERE clause with =
  const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*'([^']+)'/i);
  if (!whereMatch) return sql;

  const [fullMatch, column, value] = whereMatch;
  // Convert to IN clause
  const newWhere = `WHERE ${column} IN ('${value}')`;

  return sql.replace(fullMatch, newWhere);
}

/**
 * Remove WHERE clause
 */
function removeWhereClause(sql: string, predicate?: string): string {
  if (predicate) {
    // Remove specific predicate
    return sql.replace(new RegExp(`\\s*AND\\s+${predicate}`, "gi"), "");
  }

  // Remove entire WHERE clause
  return sql.replace(/WHERE\s+.*?(?=GROUP BY|ORDER BY|$)/i, "");
}

/**
 * Add aggregation function
 */
function addAggregation(
  sql: string,
  func?: string,
  column?: string
): string {
  const aggFunc = func || "SUM";
  const aggColumn = column || "amount";

  // Replace SELECT clause with aggregation
  return sql.replace(
    /SELECT\s+(.*?)\s+FROM/i,
    `SELECT ${aggFunc}(${aggColumn}) FROM`
  );
}

/**
 * Remove aggregation function
 */
function removeAggregation(sql: string): string {
  // Remove aggregation and GROUP BY
  let result = sql.replace(/(SUM|COUNT|AVG|MAX|MIN)\s*\([^)]+\)/gi, "*");
  result = result.replace(/\s*GROUP BY\s+[^;]+/i, "");

  return result;
}

/**
 * Add ORDER BY clause
 */
function addOrderBy(sql: string, column?: string): string {
  if (sql.match(/ORDER BY/i)) return sql; // Already has ORDER BY

  const orderColumn = column || "created_at";

  // Add ORDER BY at the end
  return `${sql.trim()} ORDER BY ${orderColumn} DESC`;
}

/**
 * Fix entity column mapping (merchant → merchant_name)
 */
function fixEntityColumn(sql: string, objective: ObjectiveConfig): string {
  const entity = objective?.scope?.entity;
  if (!entity || !entity.type) return sql;

  const correctColumn = getEntityColumn(entity.type);

  // Find incorrect entity references and fix them
  const incorrectPatterns = ["merchant", "category"].filter(
    (p) => p !== correctColumn
  );

  let result = sql;
  for (const incorrect of incorrectPatterns) {
    result = result.replace(
      new RegExp(`\\b${incorrect}\\b(?!_name)`, "gi"),
      correctColumn
    );
  }

  return result;
}

/**
 * Map entity type to correct column name
 */
function getEntityColumn(entityType: string): string {
  const mapping: Record<string, string> = {
    merchant: "merchant_name",
    merchants: "merchant_name",
    category: "category",
  };

  return mapping[entityType.toLowerCase()] || entityType;
}
