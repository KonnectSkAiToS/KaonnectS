import { audit, db } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";

/** Retention periods are configuration set by the compliance lead, never hard-coded (blueprint §09). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const { id } = await params;
  const r = db.retention.find((x) => x.id === id);
  if (!r) return fail(404, "Rule not found");
  const { months } = await body<{ months: number }>(req);
  if (!Number.isInteger(months) || months < 1 || months > 240) return fail(400, "Enter a whole number of months between 1 and 240");
  audit(c.user.name, "retention.updated", `${r.category}: ${r.months} → ${months} months`);
  r.months = months;
  return ok(r);
}
