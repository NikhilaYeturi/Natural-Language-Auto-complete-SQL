import { RL_MODEL } from "@/lib/llm/models";
import { optimizeSQL } from "./optimizer";

/**
  rlTool — Q-Learning based SQL Optimizer with feedback-control loop

  NOW USES:
  - Q-Learning for action selection
  - Experience replay for learning
  - Persistent Q-table across sessions
  - LLM = one of the actions (not the only policy)
  - Proper RL: state-action-reward-next_state tuples
 */

type Schema = {
  tables: { name: string; columns: string[] }[];
};

export type Feedback = {
  code: string;
  message: string;
  fix: string;
};

const ENTITY_COLUMN_MAP: Record<string, string> = {
  department: "d.name",
  employee: "e.name",
  user: "e.name",
};

export async function rlTool(
  rawObjective: any
): Promise<{ sql: string; iterations?: number; finalReward?: number; iterationLogs?: any[] }> {
  // 🔁 Normalize objective ONCE (critical)
  const objective = normalizeObjective(rawObjective);

  console.log("[RL] Normalized Objective:", JSON.stringify(objective, null, 2));

  const schema = await getSchema();

  // NEW: Use Q-Learning optimizer instead of simple loop
  const result = await optimizeSQL(
    objective,
    schema,
    generateSQL,       // Pass LLM policy as a function
    evaluateSQL,       // Pass critic as a function
    explainQuery       // Pass environment signal as a function
  );

  console.log(`[RL] Optimizer finished: ${result.iterations} iterations, reward: ${result.finalReward}`);

  return {
    sql: result.sql,
    iterations: result.iterations,
    finalReward: result.finalReward,
    iterationLogs: result.iterationLogs,
  };
}

  // NORMALIZATION

function normalizeObjective(objective: any) {
  const entity = objective?.scope?.entity;

  if (entity?.identifier && typeof entity.identifier === "string") {
    if (entity.identifier.includes(",")) {
      entity.identifier = entity.identifier
        .split(",")
        .map((v: string) => v.trim());
    }
  }

  return objective;
}

  // SCHEMA

async function getSchema(): Promise<Schema> {
  return {
    tables: [
      {
        name: "employees",
        columns: ["employee_id", "name", "city", "department_id"],
      },
      {
        name: "departments",
        columns: ["department_id", "name", "location"],
      },
      {
        name: "compensation",
        columns: ["employee_id", "salary", "reports_to"],
      },
      {
        name: "teams",
        columns: ["team_id", "team_name", "department_id"],
      },
      {
        name: "employee_teams",
        columns: ["employee_id", "team_id"],
      },
    ],
  };
}

   //POLICY (LLM) - Now exported for optimizer

export async function generateSQL(input: {
  objective: any;
  schema: Schema;
  previousSql: string | null;
  feedback: Feedback | null;
}): Promise<string> {
  const { objective, schema, previousSql, feedback } = input;

  const prompt = `
You are an autonomous SQL agent for an employee/department database.

OBJECTIVE:
${JSON.stringify(objective, null, 2)}

SCHEMA:
${JSON.stringify(schema, null, 2)}

RELATIONSHIPS:
- employees.department_id -> departments.department_id
- compensation.employee_id -> employees.employee_id

${previousSql ? `PREVIOUS SQL:\n${previousSql}` : ""}
${feedback ? `CRITIC FEEDBACK:\n${JSON.stringify(feedback, null, 2)}` : ""}

RULES:
- To get employee names and department names, JOIN employees (e) with departments (d) on e.department_id = d.department_id
- To get salaries, also JOIN with compensation (c) on e.employee_id = c.employee_id
- Use aliases: e for employees, d for departments, c for compensation
- For department filter, use WHERE d.name = 'Department Name'
- Select e.name for employee name, d.name AS department for department name, c.salary for salary
- Return ONLY SQL, no explanations
`;

  if (!process.env.OPENAI_API_KEY) {
    return heuristicFallback(objective);
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: RL_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: "Return ONLY SQL for the employee database." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim()
    ?? heuristicFallback(objective);
}

  // EXPLAIN (SYMBOLIC ENVIRONMENT) - Now exported for optimizer

export function explainQuery(sql: string) {
  const lower = sql.toLowerCase();

  return {
    usesJoin: lower.includes("join"),
    hasDepartmentJoin: lower.includes("join departments"),
    hasCompensationJoin: lower.includes("join compensation"),
    usesWhere: lower.includes("where"),
    filters: {
      department: lower.includes("d.name") && lower.includes("where"),
      employee: lower.includes("e.name"),
    },
    selects: {
      employeeName: lower.includes("e.name"),
      departmentName: lower.includes("d.name"),
      salary: lower.includes("salary") || lower.includes("c.salary"),
    },
  };
}
 // CRITIC (THE MOST IMPORTANT PART) - Now exported for optimizer

export function evaluateSQL(
  sql: string,
  explain: any,
  objective: any
): { passed: boolean; feedback?: Feedback } {
  const lower = sql.toLowerCase();
  const dataSource = objective?.constraints?.dataSource;
  const mustInclude = objective?.constraints?.mustInclude || [];
  const entity = objective?.scope?.entity;
  const identifier = entity?.identifier;

  // Check if query needs JOINs based on dataSource
  if (dataSource === "employees_with_compensation" || mustInclude.includes("salary")) {
    if (!explain.hasCompensationJoin) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_COMPENSATION_JOIN",
          message: "Query must JOIN with compensation table for salary",
          fix: "Add: JOIN compensation c ON e.employee_id = c.employee_id",
        },
      };
    }
  }

  if (dataSource === "employees_with_departments" || dataSource === "employees_with_compensation") {
    if (!explain.hasDepartmentJoin) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_DEPARTMENT_JOIN",
          message: "Query must JOIN with departments table",
          fix: "Add: JOIN departments d ON e.department_id = d.department_id",
        },
      };
    }
  }

  // Check for department filter
  if (identifier && entity?.type === "department") {
    if (!explain.usesWhere || !lower.includes(identifier.toLowerCase())) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_DEPARTMENT_FILTER",
          message: `Query must filter by department: ${identifier}`,
          fix: `Add: WHERE d.name = '${identifier}'`,
        },
      };
    }
  }

  // Check for required columns
  for (const col of mustInclude) {
    if (col === "salary" && !explain.selects.salary) {
      return {
        passed: false,
        feedback: {
          code: "MISSING_SALARY_COLUMN",
          message: "Query must select salary column",
          fix: "Add c.salary to SELECT clause",
        },
      };
    }
  }

  return { passed: true };
}

 //  FALLBACK (SAFE, SYMBOLIC)

function heuristicFallback(objective: any): string {
  const dataSource = objective?.constraints?.dataSource || "employees";
  const mustInclude = objective?.constraints?.mustInclude || [];
  const entity = objective?.scope?.entity;
  const identifier = entity?.identifier;

  // Determine which tables to join based on dataSource
  if (dataSource === "employees_with_compensation" || mustInclude.includes("salary")) {
    // Need employees, departments, and compensation
    const selectCols = mustInclude.length > 0
      ? mustInclude.map((col: string) => col === "name" ? "e.name" : col === "salary" ? "c.salary" : `d.${col}`).join(", ")
      : "e.name, d.name AS department, c.salary";

    let sql = `SELECT ${selectCols} FROM employees e JOIN departments d ON e.department_id = d.department_id JOIN compensation c ON e.employee_id = c.employee_id`;

    if (identifier && entity?.type === "department") {
      sql += ` WHERE d.name = '${identifier}'`;
    }

    return sql;
  }

  if (dataSource === "employees_with_departments") {
    const selectCols = mustInclude.length > 0
      ? mustInclude.map((col: string) => col === "name" ? "e.name" : `d.${col}`).join(", ")
      : "e.name, d.name AS department";

    let sql = `SELECT ${selectCols} FROM employees e JOIN departments d ON e.department_id = d.department_id`;

    if (identifier && entity?.type === "department") {
      sql += ` WHERE d.name = '${identifier}'`;
    }

    return sql;
  }

  // Default: just employees
  return `SELECT * FROM employees`;
}
