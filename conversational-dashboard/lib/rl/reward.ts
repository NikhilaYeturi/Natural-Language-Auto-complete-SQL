import { Reward } from "./types";
import { ObjectiveConfig } from "@/lib/objective/schema";

/**
 * Feedback from symbolic validation (from evaluator.ts or rlTool.ts)
 */
type EvaluationResult = {
  passed: boolean;
  feedback?: {
    code: string;
    message: string;
    fix: string;
  };
};

/**
 * Calculate reward for a SQL query given the objective
 * AUTONOMOUS: Learns from query execution, not user feedback
 */
export function calculateReward(
  sql: string,
  objective: ObjectiveConfig,
  evaluationResult: EvaluationResult,
  executionMetrics?: {
    executionTime?: number;
    rowCount?: number;
    expectedRowCount?: number;
    hasErrors?: boolean;
  }
): Reward {
  let constraintScore = 0;
  let qualityScore = 0;

  // 1. CONSTRAINT SATISFACTION (Most Important - 100 points)
  if (evaluationResult.passed) {
    constraintScore = 100; // Perfect score
  } else {
    // Partial credit based on which constraints are partially met
    constraintScore = calculatePartialCredit(sql, objective, evaluationResult);
  }

  // 2. QUERY QUALITY METRICS (up to 30 points)
  qualityScore += calculateSimplicityBonus(sql);
  qualityScore += calculateSpecificityBonus(sql);
  qualityScore += calculateCostBonus(sql);

  // 3. EXECUTION METRICS (autonomous learning - up to 20 points)
  if (executionMetrics) {
    qualityScore += calculateExecutionBonus(executionMetrics);
  }

  return {
    constraintScore,
    qualityScore,
    userFeedback: 0, // Not used in autonomous mode
    total: constraintScore + qualityScore,
  };
}

/**
 * Calculate partial credit for constraints
 */
function calculatePartialCredit(
  sql: string,
  objective: ObjectiveConfig,
  evaluationResult: EvaluationResult
): number {
  let score = 0;
  const lower = sql.toLowerCase();

  // Check timeframe constraint (partial credit)
  const timeframe = objective?.scope?.timeframe;
  if (timeframe && timeframe.value) {
    if (lower.includes("created_at") || lower.includes("date")) {
      score += 30; // Has date filtering
    }
  }

  // Check entity constraint (partial credit)
  const entity = objective?.scope?.entity;
  if (entity && entity.type) {
    const entityColumn = getEntityColumn(entity.type);
    if (lower.includes(entityColumn.toLowerCase())) {
      score += 30; // Has correct entity column
    }
  }

  // Check mustInclude constraint (partial credit)
  const mustInclude = objective?.constraints?.mustInclude || [];
  if (mustInclude.length > 0) {
    const includedCount = mustInclude.filter((field) =>
      lower.includes(field.toLowerCase())
    ).length;
    score += (includedCount / mustInclude.length) * 40; // Up to 40 points
  }

  // Give some credit if at least it's a SELECT query
  if (lower.startsWith("select")) {
    score += 10;
  }

  return Math.min(score, 90); // Cap at 90 (< 100 means not fully passing)
}

/**
 * Simplicity bonus - shorter queries are better (if they meet constraints)
 */
function calculateSimplicityBonus(sql: string): number {
  if (sql.length < 100) return 15;
  if (sql.length < 200) return 10;
  if (sql.length < 300) return 5;
  return -5; // Penalty for very long queries
}

/**
 * Specificity bonus - avoid SELECT *
 */
function calculateSpecificityBonus(sql: string): number {
  if (sql.includes("SELECT *")) return -5;

  // Bonus for selecting specific columns
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
  if (selectMatch) {
    const columns = selectMatch[1].split(",").map((c) => c.trim());
    if (columns.length > 0 && columns.length <= 5) {
      return 5; // Reasonable number of columns
    }
  }

  return 0;
}

/**
 * Cost bonus - penalize expensive operations
 */
function calculateCostBonus(sql: string): number {
  const lower = sql.toLowerCase();
  let bonus = 10; // Start with bonus

  // Penalty for SELECT *
  if (lower.includes("select *")) bonus -= 5;

  // Penalty for missing WHERE (full table scan)
  if (!lower.includes("where")) bonus -= 10;

  // Penalty for JOINs (if we have them)
  const joinCount = (lower.match(/\sjoin\s/g) || []).length;
  bonus -= joinCount * 5;

  // Bonus for LIMIT clause
  if (lower.includes("limit")) bonus += 5;

  return bonus;
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
 * Validate query semantics using EXPLAIN-like analysis
 * This ensures the query structure matches the intent
 */
export function validateQuerySemantics(
  sql: string,
  objective: ObjectiveConfig,
  explain: any
): {
  semanticsMatch: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const lower = sql.toLowerCase();
  const intent = objective.intent.toLowerCase();

  // 1. Check if intent wants to EXCLUDE but query doesn't
  if (intent.includes("except") || intent.includes("excluding")) {
    const entity = objective.scope?.entity;
    if (entity?.identifier) {
      const excludeTerm = String(entity.identifier).toLowerCase();

      // Should use != or NOT IN for exclusion
      if (!lower.includes("!=") && !lower.includes("not in")) {
        if (lower.includes(`'${excludeTerm}'`) || lower.includes(`"${excludeTerm}"`)) {
          issues.push(`Intent wants to EXCLUDE "${entity.identifier}" but query may INCLUDE it`);
        }
      }
    }
  }

  // 2. Check if intent wants ALL but query has aggregation
  if (intent.includes("all") && !intent.includes("total")) {
    if (explain.aggregation) {
      issues.push("Intent wants ALL records but query uses aggregation (SUM/COUNT)");
    }
  }

  // 3. Check if intent wants SPECIFIC entity but query doesn't filter
  if (objective.scope?.entity?.identifier) {
    const entityId = String(objective.scope.entity.identifier).toLowerCase();
    if (!lower.includes(entityId) && !intent.includes("except")) {
      issues.push(`Intent mentions "${objective.scope.entity.identifier}" but query doesn't filter by it`);
    }
  }

  // 4. Check SELECT * vs specific fields
  if (intent.includes("amount") || intent.includes("cost") || intent.includes("expense")) {
    if (lower.includes("select *")) {
      issues.push("Intent seems to want specific amount/cost but query uses SELECT *");
    }
  }

  return {
    semanticsMatch: issues.length === 0,
    issues,
  };
}

/**
 * Calculate execution-based bonus (autonomous learning)
 */
function calculateExecutionBonus(metrics: {
  executionTime?: number;
  rowCount?: number;
  expectedRowCount?: number;
  hasErrors?: boolean;
}): number {
  let bonus = 0;

  // Penalty for errors
  if (metrics.hasErrors) {
    return -20; // Major penalty
  }

  // Bonus for fast execution (< 100ms)
  if (metrics.executionTime !== undefined) {
    if (metrics.executionTime < 50) bonus += 10;
    else if (metrics.executionTime < 100) bonus += 5;
    else if (metrics.executionTime > 1000) bonus -= 5; // Slow query penalty
  }

  // Bonus for returning expected row count
  if (
    metrics.rowCount !== undefined &&
    metrics.expectedRowCount !== undefined
  ) {
    const rowDiff = Math.abs(metrics.rowCount - metrics.expectedRowCount);
    if (rowDiff === 0) bonus += 10; // Exact match
    else if (rowDiff < 5) bonus += 5; // Close enough
    else if (rowDiff > 100) bonus -= 5; // Way off
  }

  // Bonus for returning results (not empty)
  if (metrics.rowCount !== undefined && metrics.rowCount > 0) {
    bonus += 5;
  }

  return Math.max(-20, Math.min(20, bonus)); // Cap between -20 and +20
}
