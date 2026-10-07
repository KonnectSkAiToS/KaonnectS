import { db } from "@/lib/data";
import { PLAN_LIMITS } from "@/lib/billing";
import { ok } from "@/lib/server";

/** Branding and plan usage for the agency this portal belongs to. Readable by every role. */
export function GET() {
  const t = db.tenants.find((x) => x.id === db.currentTenantId)!;
  const limits = PLAN_LIMITS[t.plan];
  return ok({
    ...t,
    usage: { workers: db.workers.length, sites: db.sites.length },
    limits: { workers: Number.isFinite(limits.workers) ? limits.workers : null, sites: Number.isFinite(limits.sites) ? limits.sites : null },
  });
}
