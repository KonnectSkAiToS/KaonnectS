import { audit, db } from "@/lib/data";
import { PLAN_LIMITS } from "@/lib/billing";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { Plan, Tenant } from "@/lib/types";

const COLORS: Tenant["brandColor"][] = ["indigo", "teal", "crimson", "amber", "violet", "green", "blue", "orange"];

// ponytail: tenants share one in-memory store; real isolation is tenant_id + Postgres RLS (blueprint ADR-005).
export function GET(req: Request) {
  if (ctx(req).role !== "super_admin") return forbidden();
  return ok(
    db.tenants.map((t) => ({
      ...t,
      current: t.id === db.currentTenantId,
      monthlyPrice: PLAN_LIMITS[t.plan].price,
      usage: t.id === db.currentTenantId ? { workers: db.workers.length, sites: db.sites.length } : { workers: 0, sites: 0 },
    })),
  );
}

export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const b = await body<{ name: string; slug: string; adminEmail: string; plan: Plan; brandColor: Tenant["brandColor"] }>(req);
  if (!b.name?.trim()) return fail(400, "Agency name is required");
  if (!/^[a-z0-9-]{3,30}$/.test(b.slug ?? "")) return fail(400, "Slug must be 3–30 lowercase letters, numbers or dashes");
  if (db.tenants.some((t) => t.slug === b.slug)) return fail(409, "That slug is already taken");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.adminEmail ?? "")) return fail(400, "Enter a valid admin email");
  if (!(b.plan in PLAN_LIMITS)) return fail(400, "Choose a plan");

  const t: Tenant = {
    id: `t${db.tenants.length + 1}`, name: b.name.trim(), slug: b.slug, domain: `${b.slug}.staffing-platform.example`,
    brandColor: COLORS.includes(b.brandColor) ? b.brandColor : "indigo", plan: b.plan, status: "trial",
    createdAt: new Date().toISOString(), adminEmail: b.adminEmail,
  };
  db.tenants.push(t);
  audit(c.user.name, "tenant.provisioned", `${t.name} (${t.slug}) · ${t.plan}`);
  return ok(t, 201);
}
