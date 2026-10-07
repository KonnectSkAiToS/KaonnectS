import { db } from "@/lib/data";
import { WTR_MAX_HOURS, complianceStatus, weekHours } from "@/lib/rules";
import { ctx, ok } from "@/lib/server";

export function GET(req: Request) {
  const c = ctx(req);
  const now = Date.now();
  const past = db.shifts.filter((s) => c.siteIds.has(s.siteId) && Date.parse(s.start) < now && Date.parse(s.start) > now - 14 * 864e5);
  const worked = past.filter((s) => ["completed", "in_progress", "no_show"].includes(s.status));
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

  const bySite = db.sites
    .filter((s) => c.siteIds.has(s.id))
    .map((s) => {
      const p = past.filter((x) => x.siteId === s.id);
      const filled = p.filter((x) => x.status !== "cancelled").length;
      return { site: s.name, total: p.length, filled, fillRate: pct(filled, p.length), noShows: p.filter((x) => x.status === "no_show").length };
    });

  const iso = new Date().toISOString();
  const hours = db.workers
    .map((w) => ({ id: w.id, name: w.name, hours: weekHours(db, w.id, iso) }))
    .filter((w) => w.hours > 0 && (c.role !== "client_admin" || db.shifts.some((s) => s.workerId === w.id && c.siteIds.has(s.siteId))))
    .sort((a, b) => b.hours - a.hours);

  const compliance = { compliant: 0, expiring: 0, pending: 0, blocked: 0 };
  if (c.role !== "client_admin") for (const w of db.workers) compliance[complianceStatus(db, w)]++;

  // Margin is agency-only information.
  const margin =
    c.role === "super_admin"
      ? db.clients.map((cl) => {
          const ts = db.timesheets.filter((t) => db.sites.find((s) => s.id === t.siteId)!.clientId === cl.id);
          const revenue = ts.reduce((a, t) => a + t.hours * t.billRate!, 0);
          const cost = ts.reduce((a, t) => a + t.hours * t.payRate!, 0);
          return { client: cl.name, hours: ts.reduce((a, t) => a + t.hours, 0), revenue, cost, margin: revenue - cost, marginPct: pct(revenue - cost, revenue) };
        })
      : null;

  // Phase 2: reliability leaderboard, WTR risk and weekly margin trend.
  const inScope =
    c.role === "client_admin"
      ? new Set(db.shifts.filter((s) => c.siteIds.has(s.siteId) && s.workerId).map((s) => s.workerId))
      : null;
  const reliability = db.workers
    .filter((w) => !inScope || inScope.has(w.id))
    .map((w) => ({
      id: w.id, name: w.name, score: w.reliability,
      noShows: db.shifts.filter((s) => s.workerId === w.id && s.status === "no_show").length,
    }))
    .sort((a, b) => b.score - a.score);
  const wtrRisk = hours.filter((h) => h.hours >= WTR_MAX_HOURS * 0.8);

  const weeks = Array.from({ length: 4 }, (_, i) => {
    const end = now - i * 7 * 864e5;
    const ts = db.timesheets.filter((t) => c.siteIds.has(t.siteId) && Date.parse(t.date) <= end && Date.parse(t.date) > end - 7 * 864e5);
    const revenue = ts.reduce((a, t) => a + t.hours * t.billRate!, 0);
    const cost = ts.reduce((a, t) => a + t.hours * t.payRate!, 0);
    return { weekEnding: new Date(end).toISOString(), hours: ts.reduce((a, t) => a + t.hours, 0), revenue, cost, margin: revenue - cost };
  }).reverse();

  return ok({
    reliability,
    wtrRisk,
    weeklyMargin: c.role === "super_admin" ? weeks : null,
    fillRate: pct(past.filter((s) => s.status !== "cancelled").length, past.length),
    noShowRate: pct(worked.filter((s) => s.status === "no_show").length, worked.length),
    shiftsLast14: past.length,
    bySite,
    hours,
    wtrMax: WTR_MAX_HOURS,
    compliance: c.role === "client_admin" ? null : compliance,
    margin,
  });
}
