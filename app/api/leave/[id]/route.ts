import { audit, db } from "@/lib/data";
import { LEAVE_DAY_HOURS, leaveBalance, leaveConflicts, leaveDays } from "@/lib/rules";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role === "client_admin") return forbidden();
  const { id } = await params;
  const l = db.leave.find((x) => x.id === id);
  if (!l) return fail(404, "Leave request not found");
  if (l.status !== "pending") return fail(409, `Already ${l.status}`);

  const { status } = await body<{ status: string }>(req);
  if (status !== "approved" && status !== "rejected") return fail(400, "Status must be approved or rejected");
  const w = db.workers.find((x) => x.id === l.workerId)!;

  if (status === "approved" && l.type === "holiday") {
    const need = leaveDays(l) * LEAVE_DAY_HOURS;
    const bal = leaveBalance(db, w);
    if (!bal.eligible) return fail(422, "Umbrella workers don't accrue holiday. Reject this and record it as unavailable.");
    if (need > bal.remainingHours)
      return fail(422, "Not enough holiday balance", [`Needs ${need}h, ${w.name} has ${bal.remainingHours}h remaining`]);
  }

  // Approved leave frees the worker from any shifts already booked in that period.
  const unassigned = status === "approved" ? leaveConflicts(db, l) : [];
  for (const s of unassigned) {
    Object.assign(s, { workerId: null, status: "open", urgent: true });
    audit(c.user.name, "shift.unassigned", `${s.id} · ${w.name} on approved leave`);
  }

  l.status = status;
  l.decidedBy = c.user.name;
  audit(c.user.name, `leave.${status}`, `${w.name} · ${l.type} ${l.from} to ${l.to}`);
  return ok({ leave: l, unassignedShifts: unassigned.map((s) => s.id) });
}
