/** Minimal unified diff (LCS) so a heal is shown as a precise, reviewable patch. */
export function unifiedDiff(path: string, a: string | undefined, b: string, context = 3): string {
  const A = a == null ? [] : a.split("\n");
  const B = b.split("\n");
  if (a === b) return "";
  if (A.length * B.length > 4_000_000) return `--- a/${path}\n+++ b/${path}\n@@ file too large for inline diff @@\n`;
  const n = A.length, m = B.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: { t: " " | "-" | "+"; s: string; ai: number; bi: number }[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { ops.push({ t: " ", s: A[i], ai: i++, bi: j++ }); }
    else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) { ops.push({ t: "+", s: B[j], ai: i, bi: j++ }); }
    else { ops.push({ t: "-", s: A[i], ai: i++, bi: j }); }
  }
  const out = [`--- ${a == null ? "/dev/null" : `a/${path}`}`, `+++ b/${path}`];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].t === " ") { k++; continue; }
    const start = Math.max(0, k - context);
    let end = k;
    while (end < ops.length) {
      if (ops[end].t !== " ") { end++; continue; }
      let run = 0;
      while (end + run < ops.length && ops[end + run].t === " ") run++;
      if (run > context * 2 || end + run >= ops.length) { end = Math.min(ops.length, end + context); break; }
      end += run;
    }
    const h = ops.slice(start, end);
    const aStart = h[0].ai + 1, bStart = h[0].bi + 1;
    out.push(`@@ -${aStart},${h.filter((o) => o.t !== "+").length} +${bStart},${h.filter((o) => o.t !== "-").length} @@`, ...h.map((o) => o.t + o.s));
    k = end;
  }
  return out.join("\n") + "\n";
}
