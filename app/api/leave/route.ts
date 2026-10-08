import { audit, db } from "@/lib/data";
import { leaveBalance, leaveConflicts } from "@/lib/rules";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import { LEAVE_TYPES, type LeaveRequest, type LeaveType } from "@/lib/types";

export function GET(req: Request) {
  const c = ctx(req);
  // Client Admins only see leave for workers booked at their sites.
  const visible =
    c.role === "client_admin"
      ? new Set(db.shifts.filter((s) => c.siteIds.has(s.siteId) && s.workerId).map((s) => s.workerId))
      : null;
  return ok(
    db.leave
      .filter((l) => !visible || visible.has(l.workerId))
      .sort((a, b) => a.from.localeCompare(b.from))
      .map((l) => {
        const w = db.workers.find((x) => x.id === l.workerId)!;
        return {
          ...l,
          workerName: w.name,
          contractType: w.contractType,
          balance: leaveBalance(db, w),
          conflicts: l.status === "rejected" ? 0 : leaveConflicts(db, l).length,
        };
      }),
  );
}

const TYPES = Object.keys(LEAVE_TYPES) as LeaveType[];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Agency records leave on a worker's behalf (workers normally request it in the mobile app). */
export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role === "client_admin") return forbidden();
  const b = await body<{ workerId: string; type: LeaveType; from: string; to: string; note?: string }>(req);
  const w = db.workers.find((x) => x.id === b.workerId);
  if (!w) return fail(400, "Choose a worker");
  if (!TYPES.includes(b.type)) return fail(400, "Choose a leave type");
  if (!DATE.test(b.from ?? "") || !DATE.test(b.to ?? "") || b.to < b.from) return fail(400, "Enter a valid date range");
  if (b.type === "holiday" && w.contractType === "Umbrella")
    return fail(400, "Umbrella workers don't accrue holiday. Record it as unavailable instead.");

  const l: LeaveRequest = {
    id: `l${db.leave.length + 1}`, workerId: w.id, type: b.type, from: b.from, to: b.to,
    status: "pending", note: b.note?.trim() || undefined, requestedAt: new Date().toISOString(),
  };
  db.leave.push(l);
  audit(c.user.name, "leave.requested", `${w.name} · ${b.type} ${b.from} to ${b.to}`);
  return ok(l, 201);
}
