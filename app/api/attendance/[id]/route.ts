import { audit, db } from "@/lib/data";
import { allow, body, ctx, fail, forbidden, ok } from "@/lib/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (!allow(c, "client_admin", "super_admin")) return forbidden();
  const { id } = await params;
  const ev = db.attendance.find((a) => a.id === id);
  const shift = ev && db.shifts.find((s) => s.id === ev.shiftId);
  if (!ev || !shift || !c.siteIds.has(shift.siteId)) return fail(404, "Check-in not found");
  if (ev.status !== "pending") return fail(409, "Already decided");
  const { status } = await body<{ status: string }>(req);
  if (status !== "accepted" && status !== "rejected") return fail(400, "Status must be accepted or rejected");
  ev.status = status;
  const w = db.workers.find((x) => x.id === ev.workerId)!;
  audit(c.user.name, `attendance.manual_${status}`, `${w.name} · ${ev.reason ?? ""}`);
  return ok(ev);
}
