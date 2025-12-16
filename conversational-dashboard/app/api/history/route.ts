import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const USER_HISTORY_PATH = path.join(process.cwd(), "data", "userHistory.json");

export async function GET() {
  try {
    if (!fs.existsSync(USER_HISTORY_PATH)) {
      return NextResponse.json([]);
    }

    const raw = fs.readFileSync(USER_HISTORY_PATH, "utf8");
    const history = JSON.parse(raw);

    // Return most recent 20 queries, sorted by date descending
    const sorted = Array.isArray(history)
      ? history.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 20)
      : [];

    return NextResponse.json(sorted);
  } catch (err) {
    console.error("Failed to read user history:", err);
    return NextResponse.json([]);
  }
}
