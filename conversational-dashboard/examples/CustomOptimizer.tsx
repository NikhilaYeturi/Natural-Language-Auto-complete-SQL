/**
 * Example: Custom SQL Optimizer Component
 *
 * This demonstrates how to use the useOptimizeSQL hook
 * in a completely standalone component.
 */

"use client";

import { useState } from "react";
import { useOptimizeSQL } from "@/lib/hooks/useOptimizeSQL";

export default function CustomOptimizer() {
  const [objective, setObjective] = useState({
    intent: "Get all employees with their departments and compensation",
    constraints: {
      dataSource: "employees_with_departments_with_compensation",
      mustInclude: ["employee_id", "name", "salary", "department_name"]
    },
    scope: {
      entity: { type: "employees", identifier: null },
      timeframe: null,
      filters: []
    }
  });

  // Use the standalone hook with custom callbacks
  const {
    optimizeSQL,
    loading,
    result,
    error,
    progress,
    reset
  } = useOptimizeSQL({
    tools: ["explain", "ai"],
    onProgress: (log) => {
      console.log(`📊 Iteration ${log.iteration}:`, {
        passed: log.passed,
        reward: log.reward,
        sql: log.sql.substring(0, 60) + "..."
      });
    },
    onComplete: (result) => {
      console.log("✅ Optimization complete!", {
        sql: result.sql,
        reward: result.optimizationMetadata.finalReward,
        iterations: result.optimizationMetadata.iterations
      });
    },
    onError: (error) => {
      console.error("❌ Optimization failed:", error.message);
    }
  });

  const handleOptimize = async () => {
    try {
      await optimizeSQL(objective);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Custom SQL Optimizer</h1>

      {/* Objective Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Objective Configuration (JSON)
        </label>
        <textarea
          className="w-full h-40 p-3 border rounded font-mono text-sm"
          value={JSON.stringify(objective, null, 2)}
          onChange={(e) => {
            try {
              setObjective(JSON.parse(e.target.value));
            } catch {}
          }}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleOptimize}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Optimizing..." : "Optimize SQL"}
        </button>

        <button
          onClick={reset}
          className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Reset
        </button>
      </div>

      {/* Progress Logs */}
      {progress.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h2 className="font-semibold mb-3">Optimization Progress</h2>
          {progress.map((log, i) => (
            <div key={i} className="text-sm mb-2 font-mono">
              <span className={log.passed ? "text-green-600" : "text-red-600"}>
                Iteration {log.iteration}: {log.passed ? "✓" : "✗"}
              </span>
              <span className="text-gray-600 ml-2">
                (Reward: {log.reward})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="font-semibold text-red-800">Error</h3>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-6">
          {/* Optimized SQL */}
          <div className="p-4 bg-white border rounded">
            <h2 className="font-semibold mb-3">Optimized SQL</h2>
            <pre className="p-3 bg-gray-50 rounded text-sm font-mono overflow-x-auto">
              {result.sql}
            </pre>
          </div>

          {/* Query Analysis */}
          {result.analysis && (
            <div className="p-4 bg-white border rounded">
              <h2 className="font-semibold mb-3">Query Analysis (EXPLAIN)</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Estimated Rows</div>
                  <div className="text-2xl font-bold">{result.analysis.estimatedRows}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Estimated Cost</div>
                  <div className="text-2xl font-bold">
                    {result.analysis.estimatedCost.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-gray-600 mb-2">Features</div>
                  <div className="flex gap-2">
                    {result.analysis.usesIndex && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        ✓ Uses Index
                      </span>
                    )}
                    {result.analysis.hasAggregation && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                        Aggregation
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-gray-600 mb-2">
                    Selected Fields ({result.analysis.fields.length})
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {result.analysis.fields.map((field, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-gray-100 border rounded text-xs font-mono"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Optimization Metadata */}
          <div className="p-4 bg-white border rounded">
            <h2 className="font-semibold mb-3">Optimization Stats</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-600">Iterations</div>
                <div className="text-xl font-bold">
                  {result.optimizationMetadata.iterations}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Final Reward</div>
                <div className="text-xl font-bold">
                  {result.optimizationMetadata.finalReward}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <div className="text-sm font-semibold text-green-600">
                  {result.message}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
