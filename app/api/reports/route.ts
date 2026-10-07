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

  return ok({
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
