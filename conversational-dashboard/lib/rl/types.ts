/**
 * Generic Q-Learning Types
 * Domain-agnostic reinforcement learning types
 */

/**
 * Q-Table: Maps state-action pairs to Q-values
 * State key (string) -> Action (string) -> Q-value (number)
 */
export type QTable = Map<string, Map<string, number>>;

/**
 * Q-Learning hyperparameters
 */
export type QLearningConfig = {
  alpha: number; // Learning rate (0.1 default)
  gamma: number; // Discount factor (0.9 default)
  epsilon: number; // Exploration rate (0.2 default)
  epsilonDecay: number; // Decay rate for epsilon (0.995 default)
  epsilonMin: number; // Minimum epsilon (0.05 default)
  maxQTableSize: number; // Max entries before LRU eviction
  maxExperiences: number; // Max experiences to store
};

/**
 * Persisted Q-Table format for JSON storage
 */
export type PersistedQTable = {
  version: number;
  updatedAt: string;
  hyperparams: QLearningConfig;
  qtable: Record<string, Record<string, number>>;
};

/**
 * Experience tuple for replay buffer
 */
export type Experience = {
  id: string;
  stateKey: string;
  action: string;
  reward: number;
  nextStateKey: string;
  terminal: boolean;
  timestamp: string;
  objectiveHash: string;
};

/**
 * Reward breakdown
 */
export type Reward = {
  constraintScore: number; // 0-100: How well constraints are met
  qualityScore: number; // -20 to +30: Output quality
  total: number; // Total reward for Q-learning
};

