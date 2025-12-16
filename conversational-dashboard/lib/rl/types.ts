import { ObjectiveConfig } from "@/lib/objective/schema";

export type RLCandidate = {
  sql: string;
  explanation?: string;
};

export type RLEvaluationResult = {
  passed: boolean;
  errors: string[];
};

export type RLRunResult = {
  success: boolean;
  finalSql?: string;
  iterations: number;
  history: {
    sql: string;
    errors: string[];
  }[];
};

export type RLContext = {
  objective: ObjectiveConfig;
  maxIterations: number;
};

// ========================================
// Q-Learning RL Types
// ========================================

/**
 * SQL Action types for Q-learning
 */
export enum SQLAction {
  ADD_COLUMN = "add_column",
  REMOVE_COLUMN = "remove_column",
  ADD_WHERE_CLAUSE = "add_where",
  MODIFY_WHERE_OPERATOR = "modify_where",
  REMOVE_WHERE_CLAUSE = "remove_where",
  ADD_AGGREGATION = "add_agg",
  REMOVE_AGGREGATION = "remove_agg",
  ADD_ORDER_BY = "add_order",
  FIX_ENTITY_COLUMN = "fix_entity",
  USE_LLM_POLICY = "llm_policy",
  NO_OP = "noop",
}

/**
 * Action with parameters
 */
export type Action = {
  type: SQLAction;
  params?: Record<string, any>;
};

/**
 * SQL State representation for Q-learning
 */
export type SQLState = {
  selectColumns: string[];
  wherePredicates: string[];
  aggregations: string[];
  hasGroupBy: boolean;
  hasOrderBy: boolean;
  constraintsMet: {
    timeframe: boolean;
    entity: boolean;
    mustInclude: boolean;
  };
  estimatedCost: number;
  objectiveHash: string;
};

/**
 * Reward breakdown (autonomous learning)
 */
export type Reward = {
  constraintScore: number;    // 0-100: How well constraints are met
  qualityScore: number;        // -20 to +30: Query quality (simplicity, speed, etc.)
  userFeedback?: number;       // Deprecated: Not used in autonomous mode
  total: number;               // Total reward for Q-learning
};

/**
 * Experience tuple for replay buffer
 */
export type Experience = {
  id: string;
  stateKey: string;
  action: SQLAction;
  reward: number;
  nextStateKey: string;
  terminal: boolean;
  timestamp: string;
  objectiveHash: string;
};

/**
 * Q-Table: Maps state-action pairs to Q-values
 */
export type QTable = Map<string, Map<SQLAction, number>>;

/**
 * Q-Learning hyperparameters
 */
export type QLearningConfig = {
  alpha: number; // Learning rate
  gamma: number; // Discount factor
  epsilon: number; // Exploration rate
  epsilonDecay: number; // Decay rate for epsilon
  epsilonMin: number; // Minimum epsilon
  maxQTableSize: number; // Max entries before LRU eviction
  maxExperiences: number; // Max experiences to store
};

/**
 * Persisted Q-Table format
 */
export type PersistedQTable = {
  version: number;
  updatedAt: string;
  hyperparams: QLearningConfig;
  qtable: Record<string, Record<string, number>>;
};
