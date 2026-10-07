import { audit, db } from "@/lib/data";
import { rankCandidates, reliabilityOf } from "@/lib/rules";
import { body, ctx, fail, ok, redact, shiftView } from "@/lib/server";
import type { ShiftStatus } from "@/lib/types";

async function load(req: Request, params: Promise<{ id: string }>) {
  const c = ctx(req);
  const { id } = await params;
  const shift = db.shifts.find((s) => s.id === id && c.siteIds.has(s.siteId));
  return { c, shift };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { c, shift } = await load(req, params);
  if (!shift) return fail(404, "Shift not found");
  const ts = db.timesheets.find((t) => t.shiftId === shift.id);
  return ok({
    shift: shiftView(c, shift),
    site: db.sites.find((s) => s.id === shift.siteId),
    candidates: ["open", "applied", "assigned"].includes(shift.status) ? rankCandidates(db, shift) : [],
    attendance: db.attendance.filter((a) => a.shiftId === shift.id),
    timesheet: ts ? redact(c, ts) : null,
  });
}

// Allowed manual transitions. Check-in/out moves shifts to in_progress/completed.
const TRANSITIONS: Record<string, ShiftStatus[]> = {
  cancel: ["open", "applied", "assigned", "confirmed"],
  confirm: ["assigned"],
  no_show: ["confirmed", "in_progress"],
  unassign: ["assigned", "confirmed"],
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { c, shift } = await load(req, params);
  if (!shift) return fail(404, "Shift not found");
  const { action } = await body<{ action: string }>(req);
  if (!TRANSITIONS[action]?.includes(shift.status))
    return fail(409, `Cannot ${action ?? "update"} a shift that is ${shift.status.replace("_", " ")}`);
  if (action !== "cancel" && c.role === "client_admin") return fail(403, "Only the agency can change assignments");

  if (action === "cancel") shift.status = "cancelled";
  if (action === "confirm") shift.status = "confirmed";
  if (action === "no_show") {
    shift.status = "no_show";
    const w = db.workers.find((x) => x.id === shift.workerId);
    if (w) w.reliability = reliabilityOf(db, w.id);
  }
  if (action === "unassign") Object.assign(shift, { status: "open", workerId: null });
  audit(c.user.name, `shift.${action}`, `${shift.id} · ${db.sites.find((s) => s.id === shift.siteId)!.name}`);
  return ok(shiftView(c, shift));
}
