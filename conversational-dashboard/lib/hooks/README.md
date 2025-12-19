# useOptimizeSQL Hook

A standalone React hook for SQL optimization using Reinforcement Learning.

## Features

✅ **Fully standalone** - No dependencies on specific components
✅ **Tool-based configuration** - Choose which tools to use (explain, ai, execute)
✅ **Progress tracking** - Real-time iteration logs
✅ **Type-safe** - Full TypeScript support
✅ **Flexible callbacks** - onProgress, onComplete, onError
✅ **Reusable** - Works in any React component

## Basic Usage

```tsx
import { useOptimizeSQL } from '@/lib/hooks/useOptimizeSQL';

function MyComponent() {
  const { optimizeSQL, loading, result, error } = useOptimizeSQL();

  const handleOptimize = async () => {
    const objective = {
      intent: "Get all employees with their departments",
      constraints: { mustInclude: ["employee_id", "name", "department"] }
    };

    const result = await optimizeSQL(objective);
    console.log("Optimized SQL:", result.sql);
  };

  return (
    <button onClick={handleOptimize} disabled={loading}>
      {loading ? "Optimizing..." : "Optimize SQL"}
    </button>
  );
}
```

## Advanced Usage

### With Progress Tracking

```tsx
function AdvancedComponent() {
  const { optimizeSQL, loading, progress } = useOptimizeSQL({
    tools: ["explain", "ai"],
    onProgress: (log) => {
      console.log(`Iteration ${log.iteration}: Reward ${log.reward}`);
    },
    onComplete: (result) => {
      console.log("Optimization complete!", result);
    },
    onError: (error) => {
      console.error("Optimization failed:", error);
    }
  });

  return (
    <div>
      <button onClick={() => optimizeSQL(objective)}>
        Optimize
      </button>

      {progress.map((log, i) => (
        <div key={i}>
          Iteration {log.iteration}: {log.passed ? "✓" : "✗"}
          (Reward: {log.reward})
        </div>
      ))}
    </div>
  );
}
```

### With Query Execution

```tsx
function ExecutionExample() {
  const { optimizeSQL, result } = useOptimizeSQL({
    tools: ["explain", "ai", "execute"]  // Include execution
  });

  return (
    <div>
      {result?.executionResults && (
        <div>
          <p>Returned {result.executionResults.rowCount} rows</p>
          <p>Execution time: {result.executionResults.executionTime}ms</p>
        </div>
      )}
    </div>
  );
}
```

### Custom API Endpoint

```tsx
function CustomEndpoint() {
  const { optimizeSQL } = useOptimizeSQL({
    apiEndpoint: "/api/custom/optimize",
    tools: ["ai"]
  });

  // Use as normal
}
```

## API Reference

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tools` | `Array<"explain" \| "ai" \| "execute">` | `["explain", "ai"]` | Which optimization tools to use |
| `onProgress` | `(log: ProgressLog) => void` | - | Callback for iteration updates |
| `onComplete` | `(result: OptimizationResult) => void` | - | Callback when optimization finishes |
| `onError` | `(error: Error) => void` | - | Callback on error |
| `apiEndpoint` | `string` | `"/api/optimize-sql"` | API endpoint to call |

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `optimizeSQL` | `(objective: any) => Promise<OptimizationResult>` | Function to start optimization |
| `loading` | `boolean` | Whether optimization is in progress |
| `result` | `OptimizationResult \| null` | The optimization result |
| `error` | `Error \| null` | Error if optimization failed |
| `progress` | `ProgressLog[]` | Array of iteration logs |
| `reset` | `() => void` | Reset hook state |

## Integration Examples

### Replace existing optimization code

**Before:**
```tsx
const optimizeSQL = async () => {
  const res = await fetch("/api/rl/execute", {
    method: "POST",
    body: JSON.stringify({ objective })
  });
  const data = await res.json();
  setSql(data.sql);
};
```

**After:**
```tsx
const { optimizeSQL } = useOptimizeSQL();

const handleOptimize = async () => {
  const result = await optimizeSQL(objective);
  setSql(result.sql);
};
```

### With React Query (Optional)

```tsx
import { useMutation } from '@tanstack/react-query';
import { useOptimizeSQL } from '@/lib/hooks/useOptimizeSQL';

function QueryComponent() {
  const { optimizeSQL } = useOptimizeSQL();

  const mutation = useMutation({
    mutationFn: optimizeSQL,
    onSuccess: (data) => {
      console.log("SQL:", data.sql);
    }
  });

  return <button onClick={() => mutation.mutate(objective)}>Optimize</button>;
}
```

## TypeScript

All types are exported for use in your components:

```tsx
import type {
  OptimizeSQLOptions,
  OptimizationResult,
  ProgressLog
} from '@/lib/hooks/useOptimizeSQL';
```
