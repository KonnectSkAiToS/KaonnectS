import { audit, db } from "@/lib/data";
import { bookingBlockers } from "@/lib/rules";
import { body, ctx, fail, ok, shiftView } from "@/lib/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role === "client_admin") return fail(403, "Client Admins can request workers but only the agency assigns them");
  const { id } = await params;
  const shift = db.shifts.find((s) => s.id === id && c.siteIds.has(s.siteId));
  if (!shift) return fail(404, "Shift not found");
  // Future assigned/confirmed shifts can be reassigned (e.g. drag-and-drop on the rota).
  const reassignable = ["assigned", "confirmed"].includes(shift.status) && Date.parse(shift.start) > Date.now();
  if (!["open", "applied"].includes(shift.status) && !reassignable)
    return fail(409, `Shift is already ${shift.status.replace("_", " ")}`);

  const { workerId } = await body<{ workerId: string }>(req);
  const worker = db.workers.find((w) => w.id === workerId);
  if (!worker) return fail(400, "Worker not found");
  if (worker.id === shift.workerId) return fail(409, `${worker.name} is already on this shift`);

  // Booking guard: compliance, double-booking, rest and WTR limits are enforced here, not only in the UI.
  const site = db.sites.find((s) => s.id === shift.siteId)!;
  const reasons = bookingBlockers(db, worker, shift, site);
  if (reasons.length) return fail(422, `${worker.name} cannot be booked`, reasons);

  Object.assign(shift, { workerId, status: "assigned" });
  audit(c.user.name, "shift.assigned", `${worker.name} → ${site.name} ${shift.start.slice(0, 10)}`);
  return ok(shiftView(c, shift));
}
