import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HISTORY_PATH = path.join(process.cwd(), "app", "data", "queryHistory.json");
const USER_HISTORY_PATH = path.join(process.cwd(), "data", "userHistory.json");


function readHistory() { //to read the history file
  try {
    if (!fs.existsSync(HISTORY_PATH)) { // if file doesn't exist, return empty array
      return [];
    }
    const text = fs.readFileSync(HISTORY_PATH, "utf8"); // read file content
    return JSON.parse(text); // parse and return JSON content
  } catch (err) { // on error, log and return empty array
    console.error("Error reading history:", err);
    return [];
  }
}

//to append a new entry to the history file
function appendHistory(entry: any) {
  const history = readHistory();

  const item = { // create new history item
    id: Date.now(),
    naturalText: entry.naturalText || "",
    sqlQuery: entry.sqlQuery || "",
    rowCount: entry.rowCount || 0,
    createdAt: new Date().toISOString(), // current timestamp
  };

  history.push(item); // add new item to history array

  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true }); // ensure directory exists
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8"); // write updated history back to file

  return item; // return the saved history item
}

// GET: Return full history
export async function GET() {
  try {
    const queryHistory = readHistory(); // read query history

    // Load user history (array of strings) and normalize to same shape
    let userHistoryRaw: string[] = [];
    try {
      if (fs.existsSync(USER_HISTORY_PATH)) {
        userHistoryRaw = JSON.parse(fs.readFileSync(USER_HISTORY_PATH, "utf8")); // read user history file
      }
    } catch {
      userHistoryRaw = []; // on error, default to empty array
    }

    // userHistory.json may contain either strings or objects; preserve createdAt when present
    const userEntries = (Array.isArray(userHistoryRaw) ? userHistoryRaw : []).map((entry: any, idx: number) => {
      if (typeof entry === "string") {
        return {
          id: `u-${idx}-${entry?.length || 0}`,
          naturalText: entry,
          sqlQuery: "",
          rowCount: undefined,
          createdAt: new Date().toISOString(), 
          source: "user",
        };
      }

      return {
        id: entry.id || `u-${idx}-${(entry.naturalText || "").length}`,
        naturalText: entry.naturalText || "",
        sqlQuery: "",
        rowCount: undefined,
        createdAt: entry.createdAt || new Date().toISOString(),
        source: "user",
      };
    });

    // Mark query history entries with source
    const queryEntries = queryHistory.map((h: any) => ({ ...h, source: "query" })); // add source field

    // Combine and sort by createdAt descending
    const combined = [...queryEntries, ...userEntries].sort((a, b) => { // sort by createdAt
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });

    return NextResponse.json(combined); // return combined history as JSON response
  } catch (err) {
    console.error("GET /query-history error:", err);
    return NextResponse.json([]); // on error, return empty array
  }
}

// POST: Add a new query to history
export async function POST(req: Request) { // handle POST request to add new history entry
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
