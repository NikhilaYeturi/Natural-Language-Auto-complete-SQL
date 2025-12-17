export type ObjectiveConfig = {
  intent: string;

  scope: {
    timeframe: {
      type: "RELATIVE" | "ABSOLUTE";
      value: string;
    };
    entity: {
      type: string;
      identifier?: string | string[];
    };
    // NEW: Support for mixed entity types (e.g., category + merchant)
    filters?: Array<{
      field: "merchant_name" | "category";
      value: string | string[];
    }>;
  };

  constraints: {
    dataSource?: string;
    mustInclude?: string[];
    // NEW: RL-specific constraints
    mustIncludeFields?: string[]; // Required SELECT columns
    forbiddenFields?: string[]; // Columns that cannot be included
    maxRowCount?: number; // Maximum result size
  };

  // NEW: RL loop policy
  loopPolicy?: {
    maxIterations?: number;
  };
};

