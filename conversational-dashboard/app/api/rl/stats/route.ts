import { NextRequest, NextResponse } from "next/server";
import { getQTableStats } from "@/lib/rl/qlearning";
import { getExperienceStats } from "@/lib/rl/experience";

/**
 * GET /api/rl/stats
 *
 * Returns RL training statistics:
 * - Q-table size
 * - Number of experiences
 * - Average reward
 * - Success rate
 * - Epsilon value
 * - Top learned state-action pairs
 */
export async function GET(req: NextRequest) {
  try {
    const qTableStats = getQTableStats();
    const experienceStats = getExperienceStats();

    return NextResponse.json({
      qTable: {
        size: qTableStats.size,
        epsilon: qTableStats.epsilon,
        queriesProcessed: qTableStats.queriesProcessed,
        topStateActions: qTableStats.topStateActions.map((entry) => ({
          stateKey: entry.stateKey.substring(0, 50) + "...", // Truncate for readability
          action: entry.action,
          qValue: entry.qValue.toFixed(2),
        })),
      },
      experiences: {
        totalExperiences: experienceStats.totalExperiences,
        averageReward: experienceStats.averageReward.toFixed(2),
        successRate: (experienceStats.successRate * 100).toFixed(1) + "%",
        recentRewards: experienceStats.recentRewards,
      },
      message: "RL statistics retrieved successfully",
    });
  } catch (error) {
    console.error("[Stats API] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve RL stats", details: String(error) },
      { status: 500 }
    );
  }
}
