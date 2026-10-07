import { audit, db } from "@/lib/data";
import { PLAN_LIMITS } from "@/lib/billing";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { Tenant } from "@/lib/types";

const COLORS: Tenant["brandColor"][] = ["indigo", "teal", "crimson", "amber", "violet", "green", "blue", "orange"];
const STATUSES: Tenant["status"][] = ["active", "trial", "suspended"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const { id } = await params;
  const t = db.tenants.find((x) => x.id === id);
  if (!t) return fail(404, "Tenant not found");
  const b = await body<Partial<Pick<Tenant, "name" | "brandColor" | "plan" | "status" | "domain">>>(req);

  if (b.name !== undefined && !b.name.trim()) return fail(400, "Name can't be empty");
  if (b.brandColor !== undefined && !COLORS.includes(b.brandColor)) return fail(400, "Unknown brand colour");
  if (b.status !== undefined && !STATUSES.includes(b.status)) return fail(400, "Unknown status");
  if (b.status === "suspended" && t.id === db.currentTenantId) return fail(409, "You can't suspend the agency you're signed in to");
  if (b.domain !== undefined && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(b.domain)) return fail(400, "Enter a valid domain");
  if (b.plan !== undefined) {
    if (!(b.plan in PLAN_LIMITS)) return fail(400, "Unknown plan");
    const lim = PLAN_LIMITS[b.plan];
    const usage = t.id === db.currentTenantId ? { workers: db.workers.length, sites: db.sites.length } : { workers: 0, sites: 0 };
    if (usage.workers > lim.workers || usage.sites > lim.sites)
      return fail(422, `Too much usage for the ${b.plan} plan`, [`${usage.workers}/${lim.workers} workers`, `${usage.sites}/${lim.sites} sites`]);
  }

  Object.assign(t, { ...b, name: b.name?.trim() ?? t.name });
  audit(c.user.name, "tenant.updated", `${t.name} · ${Object.keys(b).join(", ")}`);
  return ok(t);
}
