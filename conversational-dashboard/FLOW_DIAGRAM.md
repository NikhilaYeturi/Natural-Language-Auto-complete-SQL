# Q-Learning SQL Optimizer - Execution Flow Diagram

## Complete File Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER ACTION: Clicks "Approve" on ObjectiveFunction             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Frontend sends POST request to /api/rl/execute                 │
│  Body: { objective: ObjectiveConfig }                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📄 app/api/rl/execute/route.ts                                 │
│  Line 16: const result = await rlTool(objective)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📄 lib/rl/rlTool.ts                                            │
│  Line 35: const objective = normalizeObjective(rawObjective)    │
│  Line 39: const schema = await getSchema()                      │
│  Line 42: const result = await optimizeSQL(...)                 │
│           ↓ Passes 3 functions as parameters:                   │
│           - generateSQL (line 102)                              │
│           - evaluateSQL (line 177)                              │
│           - explainQuery (line 159)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📄 lib/rl/optimizer.ts - MAIN Q-LEARNING LOOP STARTS           │
│  Line 30: async function optimizeSQL(...)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ╔═══════════════════════════════════════╗
        ║   FOR EACH ITERATION (1 to maxIter)   ║
        ╚═══════════════════════════════════════╝
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 1: Generate Initial SQL (if iteration = 1)      │
│  Line 55: currentSQL = await generateSQL(...)                   │
│           ↓                                                      │
│  📄 lib/rl/rlTool.ts                                            │
│  Line 102: export async function generateSQL(...)               │
│  Line 134: fetch("https://api.openai.com/v1/chat/completions")  │
│  Returns: SQL string from LLM                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 2: Extract Current State                        │
│  Line 64: const currentState = extractState(currentSQL, obj)    │
│           ↓                                                      │
│  📄 lib/rl/state.ts                                             │
│  Line 12: export function extractState(...)                     │
│  Line 17: selectColumns: extractSelectColumns(sql)              │
│  Line 18: wherePredicates: extractWherePredicates(sql)          │
│  Line 19: aggregations: extractAggregations(sql)                │
│  Line 27: estimatedCost: estimateQueryCost(sql)                 │
│  Line 28: objectiveHash: hashObjective(objective)               │
│  Returns: SQLState object                                       │
│           ↓                                                      │
│  Line 65: const currentStateKey = stateKey(currentState)        │
│           ↓                                                      │
│  📄 lib/rl/state.ts                                             │
│  Line 34: export function stateKey(state: SQLState): string     │
│  Returns: Serialized state string for Q-table lookup            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 3: Get Applicable Actions                       │
│  Line 70: const applicableActions = getApplicableActions(...)   │
│           ↓                                                      │
│  📄 lib/rl/actions.ts                                           │
│  Line 25: export function getApplicableActions(...)             │
│  Returns: SQLAction[] (e.g., [USE_LLM_POLICY, ADD_WHERE, ...])  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 4: Select Action (Epsilon-Greedy)               │
│  Line 74: const selectedAction = selectAction(stateKey, ...)    │
│           ↓                                                      │
│  📄 lib/rl/qlearning.ts                                         │
│  Line 59: export function selectAction(...)                     │
│  Line 61: if (Math.random() < config.epsilon)                   │
│           ↓ YES: Random exploration                             │
│           return applicableActions[randomIndex]                 │
│           ↓ NO: Exploit best Q-value                            │
│  Line 70: bestQValue = getQValue(stateKey, action)              │
│           ↓                                                      │
│  📄 lib/rl/qlearning.ts                                         │
│  Line 46: export function getQValue(...)                        │
│  Returns: Q-value from in-memory qtable Map                     │
│           ↓                                                      │
│  Returns: SQLAction (e.g., USE_LLM_POLICY)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 5: Apply Action                                 │
│  Line 79: if (selectedAction === SQLAction.USE_LLM_POLICY)      │
│           ↓ YES:                                                 │
│  Line 81: nextSQL = await generateSQL(...)                      │
│           ↓                                                      │
│  📄 lib/rl/rlTool.ts                                            │
│  Line 102: export async function generateSQL(...)               │
│  (Calls LLM with previous SQL and feedback)                     │
│  Returns: Refined SQL string                                    │
│           ↓ NO (transformation action):                         │
│  Line 90: nextSQL = applyAction(...)                            │
│           ↓                                                      │
│  📄 lib/rl/actions.ts                                           │
│  Line 33: export function applyAction(...)                      │
│  Line 35: switch (action.type)                                  │
│           ↓ Calls transformation function:                      │
│           - addColumn (line 87)                                 │
│           - fixEntityColumn (line 97)                           │
│           - modifyWhereOperator (line 115)                      │
│           - etc.                                                │
│  Returns: Transformed SQL string                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 6: Evaluate SQL (Symbolic Validation)           │
│  Line 99: const explain = explainQuery(nextSQL)                 │
│           ↓                                                      │
│  📄 lib/rl/rlTool.ts                                            │
│  Line 159: export function explainQuery(sql: string)            │
│  Line 163: usesIn: lower.includes(" in ")                       │
│  Line 164: usesEquality: lower.includes("=")                    │
│  Line 166: merchant: lower.includes("merchant_name")            │
│  Line 169: aggregation: lower.includes("sum(")                  │
│  Returns: Explain object                                        │
│           ↓                                                      │
│  Line 100: const evaluationResult = evaluateSQL(...)            │
│           ↓                                                      │
│  📄 lib/rl/rlTool.ts                                            │
│  Line 177: export function evaluateSQL(...)                     │
│  Line 197: if (!explain.filters[entity.type])                   │
│           return { passed: false, feedback: {...} }             │
│  Line 210: if (Array.isArray(ids) && !explain.usesIn)           │
│           return { passed: false, feedback: {...} }             │
│  Line 236: return { passed: true }                              │
│  Returns: { passed: boolean, feedback?: Feedback }              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 7: Semantic Validation (EXPLAIN-like)           │
│  Line 108: const semanticValidation = validateQuerySemantics()  │
│           ↓                                                      │
│  📄 lib/rl/reward.ts                                            │
│  Line 173: export function validateQuerySemantics(...)          │
│  Line 186: if (intent.includes("except"))                       │
│  Line 192: if (!lower.includes("!=") && !lower.includes("not")) │
│           issues.push("Intent wants to EXCLUDE but query uses =")│
│  Line 201: if (intent.includes("all") && explain.aggregation)   │
│           issues.push("Intent wants ALL but query aggregates")  │
│  Line 208: if (objective.scope?.entity?.identifier)             │
│           Check if query filters by the entity                  │
│  Line 222: return { semanticsMatch: issues.length === 0 }       │
│  Returns: { semanticsMatch: boolean, issues: string[] }         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 8: Calculate Reward                             │
│  Line 115: let reward = calculateReward(...)                    │
│           ↓                                                      │
│  📄 lib/rl/reward.ts                                            │
│  Line 20: export function calculateReward(...)                  │
│  Line 35: if (evaluationResult.passed)                          │
│           constraintScore = 100                                 │
│           else constraintScore = calculatePartialCredit(...)    │
│  Line 43: qualityScore += calculateSimplicityBonus(sql)         │
│  Line 44: qualityScore += calculateSpecificityBonus(sql)        │
│  Line 45: qualityScore += calculateCostBonus(sql)               │
│  Line 49: qualityScore += calculateExecutionBonus(metrics)      │
│  Returns: { constraintScore, qualityScore, total }              │
│           ↓                                                      │
│  Line 129: if (!semanticValidation.semanticsMatch)              │
│  Line 130: const semanticPenalty = issues.length * -15          │
│  Line 132: reward.total = reward.total + semanticPenalty        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 9: Extract Next State                           │
│  Line 143: const nextState = extractState(nextSQL, objective)   │
│           ↓                                                      │
│  📄 lib/rl/state.ts                                             │
│  Line 12: export function extractState(...)                     │
│  Returns: SQLState object for next state                        │
│           ↓                                                      │
│  Line 144: const nextStateKey = stateKey(nextState)             │
│           ↓                                                      │
│  📄 lib/rl/state.ts                                             │
│  Line 34: export function stateKey(...)                         │
│  Returns: Serialized next state string                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 10: Update Q-Value (Bellman Equation)           │
│  Line 147: updateQValue(...)                                    │
│           ↓                                                      │
│  📄 lib/rl/qlearning.ts                                         │
│  Line 82: export function updateQValue(...)                     │
│  Line 97: const currentQ = getQValue(stateKey, action)          │
│  Line 98: const maxNextQ = Math.max(...)                        │
│           ↓ For each applicable action:                         │
│  Line 99: getQValue(nextStateKey, a)                            │
│  Line 102: Bellman Update:                                      │
│           newQ = currentQ + α[r + γ·maxNextQ - currentQ]        │
│  Line 103: setQValue(stateKey, action, newQ)                    │
│           ↓                                                      │
│  📄 lib/rl/qlearning.ts                                         │
│  Line 54: export function setQValue(...)                        │
│  Line 55: qtable.set(stateKey, { ...actions, [action]: value }) │
│  Updates in-memory Map with new Q-value                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 11: Store Experience (Experience Replay)        │
│  Line 156: const experience = addExperience(...)                │
│           ↓                                                      │
│  📄 lib/rl/experience.ts                                        │
│  Line 37: export function addExperience(...)                    │
│  Line 39: const exp: Experience = { ...experience, id: ... }    │
│  Line 44: experiences.push(exp)                                 │
│  Line 47: if (experiences.length > MAX_EXPERIENCES)             │
│           experiences.shift() // Circular buffer                │
│  Returns: Experience object with ID                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION STEP 12: Check Convergence                           │
│  Line 169: if (evaluationResult.passed &&                       │
│               semanticValidation.semanticsMatch &&              │
│               reward.total >= 100)                              │
│           ↓ YES: CONVERGED!                                     │
│  Line 173: saveQTable()                                         │
│           ↓                                                      │
│  📄 lib/rl/qlearning.ts                                         │
│  Line 108: export async function saveQTable()                   │
│  Line 116: await fs.writeFile("data/qtable.json", JSON.stringify)│
│  Persists Q-table to disk                                       │
│           ↓                                                      │
│  Line 174: saveExperiences()                                    │
│           ↓                                                      │
│  📄 lib/rl/experience.ts                                        │
│  Line 63: export async function saveExperiences()               │
│  Line 65: await fs.writeFile("data/experiences.json", ...)      │
│  Persists experiences to disk                                   │
│           ↓                                                      │
│  Line 177: decayEpsilon()                                       │
│           ↓                                                      │
│  📄 lib/rl/qlearning.ts                                         │
│  Line 141: export function decayEpsilon()                       │
│  Line 142: config.epsilon *= config.epsilonDecay                │
│  Line 143: config.epsilon = Math.max(epsilon, epsilonMin)       │
│  Reduces exploration over time                                  │
│           ↓                                                      │
│  Line 179: return { sql: nextSQL, iterations, finalReward }     │
│  EXIT LOOP - Return optimized SQL                               │
│           ↓ NO: Continue iteration                              │
│  Line 189: currentSQL = nextSQL                                 │
│  Line 190: previousFeedback = evaluationResult.feedback         │
│  LOOP BACK TO ITERATION STEP 2                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ╔═══════════════════════════════════════╗
        ║   END OF Q-LEARNING LOOP              ║
        ╚═══════════════════════════════════════╝
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📄 lib/rl/optimizer.ts                                         │
│  Line 201: return { sql: currentSQL, iterations, finalReward }  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📄 lib/rl/rlTool.ts                                            │
│  Line 52: return { sql, iterations, finalReward }               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📄 app/api/rl/execute/route.ts                                 │
│  Line 18: return NextResponse.json({                            │
│            sql: result.sql,                                     │
│            iterations: result.iterations,                       │
│            finalReward: result.finalReward,                     │
│            message: "✅ Fully converged" or "⚠️ Partial"        │
│           })                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Frontend receives response                                     │
│  {                                                               │
│    sql: "SELECT * FROM transactions WHERE ...",                 │
│    iterations: 3,                                               │
│    finalReward: 115,                                            │
│    message: "✅ Fully converged - SQL meets all constraints"    │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  USER sees optimized SQL query displayed                        │
└─────────────────────────────────────────────────────────────────┘


## Autonomous Learning Flow (After Query Execution)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER executes the SQL query in database                        │
│  System measures:                                               │
│  - executionTime: 45ms                                          │
│  - rowCount: 150                                                │
│  - hasErrors: false                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Frontend sends POST to /api/rl/execution                       │
│  Body: {                                                         │
│    experienceId: "abc123",                                      │
│    executionTime: 45,                                           │
│    rowCount: 150,                                               │
│    hasErrors: false                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📄 app/api/rl/execution/route.ts                               │
│  Line 25: await updateFromExecution(experienceId, {...})        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📄 lib/rl/optimizer.ts                                         │
│  Line 209: export async function updateFromExecution(...)       │
│  Line 217: const experience = getExperienceById(experienceId)   │
│           ↓                                                      │
│  📄 lib/rl/experience.ts                                        │
│  Line 54: export function getExperienceById(id: string)         │
│  Returns experience from memory                                 │
│           ↓                                                      │
│  Line 226: Calculate execution bonus/penalty                    │
│  Line 228: if (hasErrors) executionReward = -30                 │
│  Line 232: if (executionTime < 50) executionReward += 15        │
│  Line 237: if (rowCount > 0) executionReward += 10              │
│  Line 240: const newReward = experience.reward + executionReward│
│           ↓                                                      │
│  Line 249: updateQValue(stateKey, action, newReward, ...)       │
│           ↓                                                      │
│  📄 lib/rl/qlearning.ts                                         │
│  Line 82: export function updateQValue(...)                     │
│  Updates Q-value with execution-based reward                    │
│           ↓                                                      │
│  Line 258: await saveQTable()                                   │
│           ↓                                                      │
│  📄 lib/rl/qlearning.ts                                         │
│  Line 108: export async function saveQTable()                   │
│  Persists updated Q-table with execution feedback               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  System has learned from execution - Q-table improved!          │
│  Future queries will benefit from this experience               │
└─────────────────────────────────────────────────────────────────┘
```

## File Dependency Graph

```
app/api/rl/execute/route.ts
    └─→ lib/rl/rlTool.ts
            ├─→ lib/rl/optimizer.ts (main RL loop)
            │       ├─→ lib/rl/state.ts (state extraction)
            │       ├─→ lib/rl/actions.ts (SQL transformations)
            │       ├─→ lib/rl/qlearning.ts (Q-table & action selection)
            │       ├─→ lib/rl/experience.ts (experience replay)
            │       └─→ lib/rl/reward.ts (reward calculation & semantic validation)
            ├─→ lib/rl/rlTool.ts (generateSQL, evaluateSQL, explainQuery)
            └─→ lib/objective/schema.ts (ObjectiveConfig type)

app/api/rl/execution/route.ts
    └─→ lib/rl/optimizer.ts (updateFromExecution)
            ├─→ lib/rl/experience.ts (getExperienceById)
            └─→ lib/rl/qlearning.ts (updateQValue, saveQTable)

app/api/rl/stats/route.ts
    ├─→ lib/rl/qlearning.ts (getQTableStats)
    └─→ lib/rl/experience.ts (getExperienceStats)

data/qtable.json ←── lib/rl/qlearning.ts (persisted Q-values)
data/experiences.json ←── lib/rl/experience.ts (persisted experiences)
```

## Key Data Structures Flowing Between Files

1. **ObjectiveConfig** (lib/objective/schema.ts)
   - Flows from frontend → route.ts → rlTool.ts → optimizer.ts

2. **SQLState** (lib/rl/types.ts)
   - Generated by state.ts
   - Used by qlearning.ts for Q-table lookups

3. **SQLAction** (lib/rl/types.ts)
   - Selected by qlearning.ts
   - Applied by actions.ts or rlTool.ts (LLM)

4. **Reward** (lib/rl/types.ts)
   - Calculated by reward.ts
   - Used by qlearning.ts for Bellman update

5. **Experience** (lib/rl/types.ts)
   - Created by optimizer.ts
   - Stored by experience.ts
   - Used for updateFromExecution()

## Summary

**User approves ObjectiveFunction** → **API route** → **rlTool normalizes objective** → **Optimizer runs Q-Learning loop** → **Each iteration**: extract state → select action → apply transformation/LLM → evaluate → validate semantics → calculate reward → update Q-table → store experience → check convergence → **Returns optimized SQL** → **Frontend displays result** → **After execution, system learns from metrics autonomously**
