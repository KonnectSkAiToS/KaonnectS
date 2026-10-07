import { audit, db } from "@/lib/data";
import { body, ctx, fail, ok, redact } from "@/lib/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  const { id } = await params;
  const t = db.timesheets.find((x) => x.id === id && c.siteIds.has(x.siteId));
  if (!t) return fail(404, "Timesheet not found");
  if (t.status === "approved") return fail(409, "Approved timesheets are locked");

  const b = await body<{ status: string; note?: string; hours?: number }>(req);
  // Client Admin approves/disputes; Coordinator resolves disputes; Super Admin can override.
  if (c.role === "coordinator" && t.status !== "disputed") return fail(403, "Coordinators can only resolve disputed timesheets");
  if (b.status === "disputed" && !b.note?.trim()) return fail(400, "Add a note explaining the dispute");
  if (b.status !== "approved" && b.status !== "disputed") return fail(400, "Status must be approved or disputed");
  if (b.hours !== undefined && !(b.hours > 0 && b.hours <= 16)) return fail(400, "Hours must be between 0 and 16");

  t.status = b.status;
  if (b.note) t.note = b.note;
  if (b.hours !== undefined) t.hours = b.hours;
  audit(c.user.name, `timesheet.${b.status}`, `${t.id} · ${t.hours}h${b.note ? ` · ${b.note}` : ""}`);
  return ok(redact(c, t));
}
