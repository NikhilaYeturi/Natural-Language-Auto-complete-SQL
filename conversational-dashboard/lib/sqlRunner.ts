import { SAMPLE_TRANSACTIONS } from "./sampleData";

export function runLocalSQL(sql: string) {
  const rows = SAMPLE_TRANSACTIONS;

  if (sql.includes("WHERE merchant_name")) {
    const match = sql.match(/WHERE merchant_name\s*=\s*'(.+?)'/);
    if (match) {
      const merchant = match[1];
      return rows.filter(r => r.merchant_name === merchant);
    }
  }

  if (sql.includes("SUM(amount)")) {
    const match = sql.match(/WHERE merchant_name\s*=\s*'(.+?)'/);
    if (match) {
      const merchant = match[1];
      const total = rows
        .filter(r => r.merchant_name === merchant)
        .reduce((acc, r) => acc + r.amount, 0);

      return [{ total }];
    }
  }

  return rows;
}
