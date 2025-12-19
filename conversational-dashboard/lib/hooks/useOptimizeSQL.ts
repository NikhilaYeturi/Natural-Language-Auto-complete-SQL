"use client";

import { useState, useCallback } from "react";

/**
 * React Hook for SQL Optimization with RL
 *
 * A standalone, reusable hook that provides SQL optimization functionality
 * with flexible tool configuration and progress tracking.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { optimizeSQL, loading, result, error } = useOptimizeSQL({
 *     tools: ["explain", "ai"],
 *     onProgress: (log) => console.log(log),
 *     onComplete: (result) => console.log("Done!", result)
 *   });
 *
 *   const handleClick = async () => {
 *     await optimizeSQL(myObjective);
 *   };
 * }
 * ```
 */

export interface OptimizeSQLOptions {
  /** Which tools to use during optimization */
  tools?: ("explain" | "ai" | "execute")[];

  /** Callback fired on each iteration/progress update */
  onProgress?: (log: ProgressLog) => void;

  /** Callback fired when optimization completes */
  onComplete?: (result: OptimizationResult) => void;

  /** Callback fired on error */
  onError?: (error: Error) => void;

  /** API endpoint to use (defaults to /api/optimize-sql) */
  apiEndpoint?: string;
}

export interface ProgressLog {
  iteration: number;
  action: string;
  passed: boolean;
  reward: number;
  sql: string;
  timestamp: number;
}

export interface OptimizationResult {
  sql: string;
  analysis: {
    estimatedRows: number;
    estimatedCost: number;
    fields: string[];
    usesIndex: boolean;
    hasAggregation: boolean;
  } | null;
  executionResults: {
    rowCount: number;
    fields: string[];
    executionTime: number;
    rows: any[];
  } | null;
  optimizationMetadata: {
    iterations: number;
    finalReward: number;
    iterationLogs: any[];
  };
  message: string;
}

/**
 * Hook for SQL optimization with RL
 */
export function useOptimizeSQL(options: OptimizeSQLOptions = {}) {
  const {
    tools = ["explain", "ai"],
    onProgress,
    onComplete,
    onError,
    apiEndpoint = "/api/optimize-sql",
  } = options;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<ProgressLog[]>([]);

  /**
   * Optimize a SQL query based on an objective
   */
  const optimizeSQL = useCallback(
    async (objective: any): Promise<OptimizationResult> => {
      setLoading(true);
      setError(null);
      setProgress([]);

      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective, tools }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Optimization failed");
        }

        const data: OptimizationResult = await response.json();

        // Process iteration logs and fire progress callbacks
        if (data.optimizationMetadata?.iterationLogs) {
          const logs: ProgressLog[] = data.optimizationMetadata.iterationLogs.map(
            (log: any) => ({
              iteration: log.iteration,
              action: log.action,
              passed: log.evaluation?.passed || false,
              reward: log.reward?.total || 0,
              sql: log.sql,
              timestamp: Date.now(),
            })
          );

          setProgress(logs);

          // Fire onProgress for each iteration
          if (onProgress) {
            logs.forEach((log) => onProgress(log));
          }
        }

        setResult(data);

        // Fire completion callback
        if (onComplete) {
          onComplete(data);
        }

        return data;
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        // Fire error callback
        if (onError) {
          onError(error);
        }

        throw error;
      } finally {
        setLoading(false);
      }
    },
    [tools, apiEndpoint, onProgress, onComplete, onError]
  );

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setLoading(false);
    setResult(null);
    setError(null);
    setProgress([]);
  }, []);

  return {
    /** Function to trigger SQL optimization */
    optimizeSQL,

    /** Whether optimization is in progress */
    loading,

    /** The optimization result (null until complete) */
    result,

    /** Error if optimization failed */
    error,

    /** Array of progress logs from RL iterations */
    progress,

    /** Reset the hook state */
    reset,
  };
}
