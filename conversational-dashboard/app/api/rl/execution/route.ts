import { NextRequest, NextResponse } from "next/server";
import { updateFromExecution } from "@/lib/rl/optimizer";

/**
 * POST /api/rl/execution
 *
 * Update Q-values based on actual query execution results (AUTONOMOUS LEARNING)
 * Called after a query is executed to provide execution feedback to the RL system
 */
export async function POST(req: NextRequest) {
  try {
    const { experienceId, executionTime, rowCount, hasErrors } = await req.json();

    if (!experienceId) {
      return NextResponse.json(
        { error: "Missing experienceId" },
        { status: 400 }
      );
    }

    console.log(`[Execution API] Received execution metrics for ${experienceId}`);
    console.log(`[Execution API] Time: ${executionTime}ms, Rows: ${rowCount}, Errors: ${hasErrors}`);

    // Update Q-values based on execution results (autonomous learning)
    await updateFromExecution(experienceId, {
      executionTime: executionTime ?? 0,
      rowCount: rowCount ?? 0,
      hasErrors: hasErrors ?? false,
    });

    return NextResponse.json({
      success: true,
      message: `Execution metrics applied to experience ${experienceId}`,
      metrics: {
        executionTime,
        rowCount,
        hasErrors,
      },
    });
  } catch (error) {
    console.error("[Execution API] Error:", error);
    return NextResponse.json(
      { error: "Failed to apply execution metrics", details: String(error) },
      { status: 500 }
    );
  }
}
