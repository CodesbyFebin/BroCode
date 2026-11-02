// 5-field cron parser (minute hour day-of-month month day-of-week), UTC. Supports *, lists, ranges, steps.
export type Cron = { min: Set<number>; hour: Set<number>; dom: Set<number>; mon: Set<number>; dow: Set<number>; domStar: boolean; dowStar: boolean };
const RANGES: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];

function field(src: string, [lo, hi]: [number, number]): Set<number> {
  const out = new Set<number>();
  for (const part of src.split(",")) {
    const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
    if (!m) throw new Error(`bad cron field "${part}"`);
    const step = m[4] ? Number(m[4]) : 1;
    let a = lo, b = hi;
    if (m[1] !== "*") { a = Number(m[2]); b = m[3] ? Number(m[3]) : (m[4] ? hi : a); }
    if (a < lo || b > hi || a > b || step < 1) throw new Error(`cron value out of range "${part}"`);
    for (let v = a; v <= b; v += step) out.add(hi === 6 && v === 7 ? 0 : v);
  }
  return out;
}

export function parseCron(expr: string): Cron {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) throw new Error("cron needs 5 fields");
  const [min, hour, dom, mon, dow] = f.map((s, i) => field(s, RANGES[i]));
  return { min, hour, dom, mon, dow, domStar: f[2] === "*", dowStar: f[4] === "*" };
}

export function matches(c: Cron, d: Date): boolean {
  if (!c.min.has(d.getUTCMinutes()) || !c.hour.has(d.getUTCHours()) || !c.mon.has(d.getUTCMonth() + 1)) return false;
  const domOk = c.dom.has(d.getUTCDate()), dowOk = c.dow.has(d.getUTCDay());
  // Standard cron: if both restricted, either may match.
  if (!c.domStar && !c.dowStar) return domOk || dowOk;
  return domOk && dowOk;
}

/** Next matching minute strictly after `from` (searches up to ~1 year). */
export function nextRun(expr: string, from: Date): Date {
  const c = parseCron(expr);
  const d = new Date(Math.floor(from.getTime() / 60000) * 60000 + 60000);
  for (let i = 0; i < 527040; i++, d.setTime(d.getTime() + 60000)) if (matches(c, d)) return new Date(d);
  throw new Error("no run within a year");
}
