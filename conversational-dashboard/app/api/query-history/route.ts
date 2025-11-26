import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HISTORY_PATH = path.join(process.cwd(), "app", "data", "queryHistory.json");
const USER_HISTORY_PATH = path.join(process.cwd(), "data", "userHistory.json");


function readHistory() {
  try {
    if (!fs.existsSync(HISTORY_PATH)) {
      return [];
    }
    const text = fs.readFileSync(HISTORY_PATH, "utf8");
    return JSON.parse(text);
  } catch (err) {
    console.error("Error reading history:", err);
    return [];
  }
}

//to append a new entry to the history file
function appendHistory(entry: any) {
  const history = readHistory();

  const item = {
    id: Date.now(),
    naturalText: entry.naturalText || "",
    sqlQuery: entry.sqlQuery || "",
    rowCount: entry.rowCount || 0,
    createdAt: new Date().toISOString(),
  };

  history.push(item);

  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8");

  return item;
}

// GET: Return full history
export async function GET() {
  try {
    const queryHistory = readHistory();

    // Load user history (array of strings) and normalize to same shape
    let userHistoryRaw: string[] = [];
    try {
      if (fs.existsSync(USER_HISTORY_PATH)) {
        userHistoryRaw = JSON.parse(fs.readFileSync(USER_HISTORY_PATH, "utf8"));
      }
    } catch {
      userHistoryRaw = [];
    }

    const userEntries = userHistoryRaw.map((text: string, idx: number) => ({
      id: `u-${idx}-${text?.length || 0}`,
      naturalText: text,
      sqlQuery: "",
      rowCount: undefined,
      createdAt: new Date().toISOString(),
      source: "user",
    }));

    // Mark query history entries with source
    const queryEntries = queryHistory.map((h: any) => ({ ...h, source: "query" }));

    // Combine and sort by createdAt descending
    const combined = [...queryEntries, ...userEntries].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });

    return NextResponse.json(combined);
  } catch (err) {
    console.error("GET /query-history error:", err);
    return NextResponse.json([]);
  }
}

// POST: Add a new query to history
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const saved = appendHistory({
      naturalText: body.naturalText,
      sqlQuery: body.sqlQuery,
      rowCount: body.rowCount,
    });

    return NextResponse.json({ ok: true, saved });
  } catch (err) {
    console.error("POST /query-history error:", err);
    return NextResponse.json({ ok: false });
  }
}
