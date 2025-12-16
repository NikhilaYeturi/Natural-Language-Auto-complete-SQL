import { NextResponse } from "next/server";
import { SAMPLE_TRANSACTIONS } from "@/lib/sampleData";
import { appendQueryHistory } from "@/lib/queryHistory";

export async function POST(req: Request) {
  try {
    // Accept either { query } (older) or { sql } (frontend uses this)
    const body = await req.json();
    const sql = (body && (body.sql || body.query)) || ""; // extract SQL query

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ sql: "", rows: [] }); // handle empty or invalid SQL
    }

    let rows = [...SAMPLE_TRANSACTIONS];
    let outputRows: any[] = rows;

    // Support merchant_name = 'X' or merchant_name IN ('A','B') - case-insensitive
    // Also support queries that filter by category (e.g. category = 'coffee')
    
    if (/merchant_name\s+in\s*\(([^)]+)\)/i.test(sql)) {
      const match = sql.match(/merchant_name\s+in\s*\(([^)]+)\)/i); // extract list
      if (match) {
        const list = match[1]
          .split(',')
          .map((s) => s.replace(/['"\s]/g, '').toLowerCase())
          .filter(Boolean);

        outputRows = rows.filter((r) => list.includes(String(r.merchant_name).toLowerCase())); // filter rows by merchant_name
      }
    } else if (/merchant_name\s*=\s*'([^']+)'/i.test(sql)) {
      const match = sql.match(/merchant_name\s*=\s*'([^']+)'/i);
      if (match) {
        const merchant = match[1].toLowerCase();
        outputRows = rows.filter((r) => String(r.merchant_name).toLowerCase() === merchant); 
      }
    } else if (/category\s*=\s*'([^']+)'/i.test(sql) || /category\s+in\s*\(([^)]+)\)/i.test(sql)) {
      // Filter by category field directly from sample data
      const categoryInMatch = sql.match(/category\s+in\s*\(([^)]+)\)/i); // extract list of categories
      let categories: string[] = [];

      if (categoryInMatch) {
        categories = categoryInMatch[1]
          .split(',')
          .map((s) => s.replace(/['"\s]/g, '').toLowerCase())
          .filter(Boolean); // list of categories
      } else {
        const m = sql.match(/category\s*=\s*'([^']+)'/i);
        if (m) categories = [m[1].toLowerCase()]; // single category
      }

      // Filter by the category field directly
      outputRows = rows.filter((r) => categories.includes(String(r.category).toLowerCase()));
    } // end category filtering

    // SUM(amount)
    if (/sum\s*\(\s*amount\s*\)/i.test(sql)) {
      const total = outputRows.reduce(
        (sum, r) => sum + Number(r.amount),
        0
      ); // calculate total amount

      outputRows = [
        { label: "total", value: total }
      ];
    }

    // GROUP BY category
    if (/group\s+by\s+category/i.test(sql)) {
      const grouped: Record<string, number> = {};

      rows.forEach((r) => {
        grouped[r.category] = (grouped[r.category] || 0) + Number(r.amount);
      });

      outputRows = Object.entries(grouped).map(([label, value]) => ({
        label,
        value,
      }));
    }

    appendQueryHistory({
      naturalText: sql,
      sqlQuery: sql,
      rowCount: outputRows.length,
      createdAt: new Date().toISOString(),
    }); // save to query history

    return NextResponse.json({ sql, rows: outputRows });
  } catch (err) {
    console.error("RUN-QUERY ERROR:", err);
    return NextResponse.json({ sql: "", rows: [] });
  }
}
