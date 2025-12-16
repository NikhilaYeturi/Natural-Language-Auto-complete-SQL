function evaluateSQL(
  sql: string,
  objective: any,
  schema: { tables: { name: string; columns: string[] }[] }
): { passed: boolean; reason?: string } {
  const sqlLower = sql.toLowerCase();

  // Basic checks
  if (!sqlLower.startsWith("select")) {
    return { passed: false, reason: "Not a SELECT query" };
  }

  const tableUsed = schema.tables.find(t =>
    sqlLower.includes(`from ${t.name}`)
  );

  if (!tableUsed) {
    return { passed: false, reason: "Unknown table used" };
  }

  // 🔑 TIMEFRAME VALIDATION (THIS WAS MISSING)
  const timeframe = normalizeTimeframe(objective.scope?.timeframe);

  if (timeframe) {
    if (
      !sqlLower.includes(timeframe.start.toLowerCase()) ||
      !sqlLower.includes(timeframe.end.toLowerCase())
    ) {
      return {
        passed: false,
        reason: `Query does not match required timeframe ${timeframe.start} → ${timeframe.end}`,
      };
    }
  }

  // Required columns
  const mustInclude = objective.constraints?.mustInclude ?? [];
  for (const col of mustInclude) {
    if (!sqlLower.includes(col.toLowerCase())) {
      return {
        passed: false,
        reason: `Missing required column: ${col}`,
      };
    }
  }

  return { passed: true };
}
function normalizeTimeframe(timeframe: any): { start: string; end: string } | null {
  if (!timeframe) return null;

  const now = new Date();

  if (timeframe.type === "RELATIVE" && timeframe.value === "LAST_YEAR") {
    const year = now.getFullYear() - 1;
    return {
      start: `${year}-01-01`,
      end: `${year + 1}-01-01`,
    };
  }

  if (timeframe.type === "ABSOLUTE") {
    if (timeframe.value === "December 2025") {
      return {
        start: "2025-12-01",
        end: "2026-01-01",
      };
    }
  }

  return null;
}
