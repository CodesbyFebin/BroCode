// Minimal SQL statement splitter (handles quotes, comments, $$ bodies).
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let quote: string | null = null;
  while (i < sql.length) {
    const ch = sql[i]!;
    const two = sql.slice(i, i + 2);
    if (!quote && two === "--") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      cur += "\n";
      continue;
    }
    if (!quote && two === "/*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (quote) {
      if (sql.startsWith(quote, i)) {
        cur += quote;
        i += quote.length;
        quote = null;
        continue;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (two === "$$") {
      quote = "$$";
      cur += two;
      i += 2;
      continue;
    } else if (ch === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export const norm = (s: string) => s.replace(/\s+/g, " ").trim();
export const ident = (s: string) => s.replace(/^"|"$/g, "").replace(/^(public)\./i, "").toLowerCase();
