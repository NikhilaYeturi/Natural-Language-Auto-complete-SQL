import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "history.json");

export async function getHistory() {
  if (!fs.existsSync(FILE)) return [];
  const data = fs.readFileSync(FILE, "utf8");
  return JSON.parse(data);
}

export async function saveToHistory(query: string) {
  let existing = [];

  if (fs.existsSync(FILE)) {
    existing = JSON.parse(fs.readFileSync(FILE, "utf8"));
  }

  existing.push({
    query,
    timestamp: Date.now()
  });

  fs.writeFileSync(FILE, JSON.stringify(existing, null, 2));
}
