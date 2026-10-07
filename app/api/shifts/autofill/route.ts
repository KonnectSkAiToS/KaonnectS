import { audit, db } from "@/lib/data";
import { rankCandidates } from "@/lib/rules";
import { body, ctx, fail, ok } from "@/lib/server";

/**
 * Auto-matching: give each shift to its best-ranked bookable worker.
 * With no shiftIds, fills every unfilled shift in the next 72 hours.
 * Shifts are filled one at a time so each booking is checked against the ones before it.
 */
export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role === "client_admin") return fail(403, "Only the agency assigns workers");
  const { shiftIds } = await body<{ shiftIds?: string[] }>(req);
  const now = Date.now();

  const targets = db.shifts
    .filter((s) => c.siteIds.has(s.siteId) && ["open", "applied"].includes(s.status))
    .filter((s) => (shiftIds?.length ? shiftIds.includes(s.id) : Date.parse(s.start) > now && Date.parse(s.start) < now + 3 * 864e5))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.start.localeCompare(b.start));
  if (!targets.length) return fail(409, "No unfilled shifts to fill");

  const results = targets.map((s) => {
    const best = rankCandidates(db, s).find((x) => x.reasons.length === 0);
    if (!best) return { shiftId: s.id, workerId: null, workerName: null, reason: "No bookable worker" };
    Object.assign(s, { workerId: best.worker.id, status: "assigned" });
    audit(c.user.name, "shift.auto_assigned", `${best.worker.name} → ${s.id} (score ${best.score})`);
    return { shiftId: s.id, workerId: best.worker.id, workerName: best.worker.name, reason: null };
  });
  return ok({ filled: results.filter((r) => r.workerId).length, total: results.length, results });
}
