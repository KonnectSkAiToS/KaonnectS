import { db } from "@/lib/data";
import { complianceStatus, weekHours } from "@/lib/rules";
import { ctx, ok } from "@/lib/server";

export function GET(req: Request) {
  const c = ctx(req);
  // Client Admins only see workers who have been booked at their sites.
  const visible =
    c.role === "client_admin"
      ? new Set(db.shifts.filter((s) => c.siteIds.has(s.siteId) && s.workerId).map((s) => s.workerId))
      : null;
  const now = new Date().toISOString();
  return ok(
    db.workers
      .filter((w) => !visible || visible.has(w.id))
      .map((w) => ({ ...w, compliance: complianceStatus(db, w), weekHours: weekHours(db, w.id, now) })),
  );
}
