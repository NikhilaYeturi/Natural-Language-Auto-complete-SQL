# Q-Learning SQL Optimizer - Autonomous RL System

## Overview

This system implements **proper reinforcement learning** using Q-Learning to optimize SQL queries. Unlike traditional approaches, it learns **autonomously** from query execution results, not user feedback.

## Architecture

### Core RL Components

```
User Query → ObjectiveConfig
    ↓
Q-Learning Optimizer
    ├─ Extract State (SQL features)
    ├─ Select Action (epsilon-greedy)
    ├─ Apply Action (SQL transformation or LLM)
    ├─ Evaluate (symbolic validation)
    ├─ Calculate Reward (autonomous metrics)
    ├─ Update Q-Table (Bellman equation)
    └─ Store Experience
    ↓
Optimized SQL
```

### Autonomous Learning Flow

```
1. Generate SQL → Execute → Measure metrics
2. Fast execution + correct results = HIGH REWARD
3. Slow execution or errors = LOW REWARD
4. Q-table learns best actions over time
5. System improves automatically
```

## Key Features

### ✅ Proper Reinforcement Learning
- **Q-Learning algorithm** with Bellman updates
- **State-action-reward-next_state** tuples
- **Epsilon-greedy exploration** (0.2 → 0.05)
- **Experience replay** buffer (1000 experiences)
- **Persistent Q-table** across sessions

### ✅ Autonomous Learning (No User Feedback)
- **Execution-based rewards:**
  - Fast queries (<50ms): +15 points
  - Correct results: +10 points
  - Errors: -30 points penalty
- **Constraint satisfaction:** +100 for meeting all constraints
- **Query quality metrics:** Simplicity, specificity, cost

### ✅ Continuous Improvement
- Learns from every query execution
- Q-table grows with experience
- Epsilon decays (less exploration over time)
- LLM calls reduce as patterns are learned

## Reward System

### Total Reward = Constraint Score + Quality Score

#### Constraint Score (0-100 points)
- 100: All constraints satisfied ✅
- 0-90: Partial credit based on:
  - Timeframe filtering: +30
  - Entity column mapping: +30
  - Required fields present: +40

#### Quality Score (-20 to +30 points)
- **Simplicity:** Shorter queries preferred (+15 max)
- **Specificity:** Avoid `SELECT *` (+5 bonus)
- **Cost:** Penalize missing WHERE clause (-10)
- **Execution Speed:**
  - <50ms: +15
  - <100ms: +10
  - >1000ms: -10
- **Results:** Non-empty results (+10)
- **Errors:** Query errors (-30)

### Example Rewards

| Query | Constraints | Speed | Result | Total Reward |
|-------|------------|-------|--------|--------------|
| Perfect match | 100 | +15 | +10 | 125 |
| Good query | 100 | +10 | +10 | 120 |
| Slow query | 100 | -10 | +10 | 100 |
| Has errors | 60 | -30 | 0 | 30 |
| Wrong columns | 40 | +10 | +10 | 60 |

## Action Space

### SQL Transformation Actions
1. **ADD_COLUMN** - Add field to SELECT
2. **REMOVE_COLUMN** - Remove field from SELECT
3. **ADD_WHERE_CLAUSE** - Add filtering condition
4. **MODIFY_WHERE_OPERATOR** - Change = to IN
5. **FIX_ENTITY_COLUMN** - Fix merchant → merchant_name
6. **ADD_AGGREGATION** - Add SUM/COUNT
7. **REMOVE_AGGREGATION** - Remove aggregation
8. **ADD_ORDER_BY** - Add sorting
9. **USE_LLM_POLICY** - Generate SQL via GPT (fallback)
10. **NO_OP** - No change

### Action Selection (Epsilon-Greedy)
```python
if random() < epsilon:
    return random_action()  # Explore
else:
    return argmax(Q[state])  # Exploit
```

## API Endpoints

### 1. Execute RL Optimizer
```bash
POST /api/rl/execute
{
  "objective": { ... }
}

Response:
{
  "sql": "SELECT ...",
  "iterations": 3,
  "finalReward": 115,
  "message": "✅ Fully converged"
}
```

### 2. Update from Execution (Autonomous Learning)
```bash
POST /api/rl/execution
{
  "experienceId": "abc123",
  "executionTime": 45,
  "rowCount": 150,
  "hasErrors": false
}

Response:
{
  "success": true,
  "message": "Execution metrics applied"
}
```

### 3. Get RL Statistics
```bash
GET /api/rl/stats

Response:
{
  "qTable": {
    "size": 234,
    "epsilon": 0.12,
    "queriesProcessed": 150
  },
  "experiences": {
    "totalExperiences": 450,
    "averageReward": 98.5,
    "successRate": "92.3%"
  }
}
```

## Learning Process

### First Query
```
1. Q-table empty
2. Epsilon-greedy selects random action
3. Likely uses LLM policy
4. SQL generated: "SELECT * FROM transactions WHERE merchant_name = 'Starbucks'"
5. Executes in 65ms, returns 15 rows
6. Reward = 100 (constraints) + 10 (speed) + 10 (results) = 120
7. Q(state, USE_LLM_POLICY) = 120
```

### After 50 Queries
```
1. Q-table has ~150 state-action pairs
2. Epsilon decayed to 0.1 (less exploration)
3. Learned patterns:
   - USE_LLM_POLICY for complex queries: Q=110
   - FIX_ENTITY_COLUMN for merchant queries: Q=105
   - ADD_WHERE_CLAUSE when filtering needed: Q=95
4. LLM calls reduced by 40%
5. Faster convergence (3 iterations → 2 iterations avg)
```

### After 500 Queries
```
1. Q-table has ~600 state-action pairs
2. Epsilon at minimum (0.05)
3. System knows:
   - Best actions for common query patterns
   - When to use LLM vs transformations
   - Which columns to select for different objectives
4. LLM calls reduced by 70%
5. Near-instant convergence (1-2 iterations)
```

## File Structure

```
lib/rl/
├── optimizer.ts       # Main Q-learning loop
├── qlearning.ts       # Q-table, epsilon-greedy, Bellman updates
├── state.ts           # SQL state extraction
├── actions.ts         # SQL transformation functions
├── reward.ts          # Autonomous reward calculation
├── experience.ts      # Experience replay buffer
├── rlTool.ts          # Entry point (calls optimizer)
└── types.ts           # RL type definitions

app/api/rl/
├── execute/route.ts   # Run optimizer
├── execution/route.ts # Update from execution metrics
└── stats/route.ts     # RL statistics

data/
├── qtable.json        # Persistent Q-values
└── experiences.json   # Experience replay buffer
```

## Q-Learning Algorithm

### Bellman Update Rule
```
Q(s,a) = Q(s,a) + α[r + γ·max(Q(s',a')) - Q(s,a)]

Where:
- α = 0.1 (learning rate)
- γ = 0.9 (discount factor)
- r = reward from environment
- max(Q(s',a')) = best Q-value for next state
```

### Hyperparameters
```typescript
{
  alpha: 0.1,              // Learning rate
  gamma: 0.9,              // Discount factor
  epsilon: 0.2,            // Initial exploration
  epsilonDecay: 0.995,     // Decay per query
  epsilonMin: 0.05,        // Minimum exploration
  maxQTableSize: 10000,    // Max state-action pairs
  maxExperiences: 1000     // Circular buffer size
}
```

## Implementation Details

### State Representation
```typescript
{
  selectColumns: ["id", "amount"],
  wherePredicates: ["merchant_name = 'Starbucks'"],
  aggregations: [],
  hasGroupBy: false,
  hasOrderBy: false,
  constraintsMet: {
    timeframe: true,
    entity: true,
    mustInclude: true
  },
  estimatedCost: 25,
  objectiveHash: "a3f2c1b4"
}
```

### Q-Table Storage
```json
{
  "version": 1,
  "updatedAt": "2025-12-16T10:00:00Z",
  "hyperparams": { ... },
  "qtable": {
    "state_hash_1": {
      "USE_LLM_POLICY": 110.5,
      "FIX_ENTITY_COLUMN": 95.2,
      "ADD_WHERE_CLAUSE": 85.0
    }
  }
}
```

### Experience Tuple
```typescript
{
  id: "a3f2c1b4",
  stateKey: "id,amount||merchant_name='X'||...",
  action: "USE_LLM_POLICY",
  reward: 120,
  nextStateKey: "...",
  terminal: true,
  timestamp: "2025-12-16T10:00:00Z",
  objectiveHash: "a3f2c1b4"
}
```

## Advantages Over User Feedback

| User Feedback | Autonomous Learning |
|--------------|---------------------|
| Requires user action | Fully automatic |
| Subjective ratings | Objective metrics |
| Delayed feedback | Immediate feedback |
| Low signal (binary) | Rich signal (timing, results, errors) |
| User fatigue | Never tires |
| Inconsistent | Consistent |

## Performance Metrics

### Expected Improvements (After 500 Queries)

- **LLM API Costs:** -70% (fewer calls)
- **Convergence Speed:** 50% faster (fewer iterations)
- **Success Rate:** 95%+ (constraint satisfaction)
- **Average Reward:** 110+ (high quality)
- **Query Optimization:** 30% faster execution

## Future Enhancements

1. **Deep Q-Learning:** Replace Q-table with neural network for larger state space
2. **Multi-Objective Optimization:** Balance speed vs accuracy vs cost
3. **Transfer Learning:** Pre-train on SQL corpus
4. **Policy Gradient:** REINFORCE for continuous action space
5. **A/B Testing:** Compare RL vs LLM-only performance

---

## Summary

This system implements **proper reinforcement learning** for SQL query optimization:

✅ Q-Learning with Bellman updates (not just symbolic validation)
✅ Autonomous learning from execution metrics (no user feedback needed)
✅ Persistent Q-table that improves over time
✅ Epsilon-greedy exploration that decays naturally
✅ Experience replay for offline learning
✅ Observable via `/api/rl/stats` endpoint

The system learns automatically from every query execution and continuously improves its SQL generation strategy without any manual intervention.
