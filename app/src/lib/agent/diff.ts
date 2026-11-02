export type DiffLine = { kind: "same" | "add" | "del"; text: string };

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const m = a.length;
  const n = b.length;
  if (m + n > 4000) {
    return compact(a, b);
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? (dp[i + 1]![j + 1]! + 1) : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i]! });
      i++;
    } else {
      out.push({ kind: "add", text: b[j]! });
      j++;
    }
  }
  while (i < m) out.push({ kind: "del", text: a[i++]! });
  while (j < n) out.push({ kind: "add", text: b[j++]! });
  return collapseSame(out);
}

function compact(a: string[], b: string[]): DiffLine[] {
  const out: DiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) {
      if (a[i] != null) out.push({ kind: "same", text: a[i]! });
    } else {
      if (a[i] != null) out.push({ kind: "del", text: a[i]! });
      if (b[i] != null) out.push({ kind: "add", text: b[i]! });
    }
  }
  return collapseSame(out);
}

function collapseSame(lines: DiffLine[]): DiffLine[] {
  const out: DiffLine[] = [];
  let sameRun: DiffLine[] = [];
  const flush = () => {
    if (sameRun.length > 8) {
      out.push(...sameRun.slice(0, 3));
      out.push({ kind: "same", text: `… ${sameRun.length - 6} unchanged lines` });
      out.push(...sameRun.slice(-3));
    } else {
      out.push(...sameRun);
    }
    sameRun = [];
  };
  for (const line of lines) {
    if (line.kind === "same") sameRun.push(line);
    else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out;
}
