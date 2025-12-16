import { ObjectiveConfig } from "./schema";

export function validateObjective(obj: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!obj?.intent || typeof obj.intent !== "string") {
    errors.push("Missing objective.intent");
  }

  if (!Array.isArray(obj.successCriteria) || obj.successCriteria.length === 0) {
    errors.push("Missing successCriteria");
  }

  if (!obj.scope?.timeframe) {
    errors.push("Missing scope.timeframe");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
