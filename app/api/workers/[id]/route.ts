import { db } from "@/lib/data";
import { complianceStatus, leaveBalance, missingDocs, requiredDocsFor, weekHours } from "@/lib/rules";
import { ctx, fail, ok, shiftView } from "@/lib/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  const { id } = await params;
  const w = db.workers.find((x) => x.id === id);
  if (!w) return fail(404, "Worker not found");
  const shifts = db.shifts
    .filter((s) => s.workerId === id && c.siteIds.has(s.siteId))
    .sort((a, b) => b.start.localeCompare(a.start));
  if (c.role === "client_admin" && !shifts.length) return fail(403, "This worker has not worked at your sites.");
  const now = new Date().toISOString();
  return ok({
    worker: w,
    compliance: complianceStatus(db, w),
    missing: missingDocs(db, id, requiredDocsFor(w), now),
    weekHours: weekHours(db, id, now),
    documents: db.documents.filter((d) => d.workerId === id),
    shifts: shifts.map((s) => shiftView(c, s)),
    leaveBalance: leaveBalance(db, w),
    leave: db.leave.filter((l) => l.workerId === id && l.status !== "rejected" && l.to >= now.slice(0, 10)),
  });
}
