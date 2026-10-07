import { audit, db } from "@/lib/data";
import { allow, body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { DocType, Site } from "@/lib/types";

const ALL_DOCS: DocType[] = ["DBS Enhanced", "Manual Handling", "Safeguarding", "Food Hygiene"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  const { id } = await params;
  const site = db.sites.find((s) => s.id === id);
  if (!site || !c.siteIds.has(id)) return fail(404, "Site not found");
  const b = await body<Partial<Pick<Site, "radiusM" | "sitePin" | "requiredDocs">>>(req);

  if (b.requiredDocs && !allow(c, "super_admin", "client_admin")) return forbidden();
  if ((b.radiusM !== undefined || b.sitePin !== undefined) && !allow(c, "super_admin")) return forbidden();
  if (b.radiusM !== undefined && !(b.radiusM >= 50 && b.radiusM <= 500)) return fail(400, "Geofence radius must be between 50 and 500 m");
  if (b.requiredDocs && !b.requiredDocs.every((d) => ALL_DOCS.includes(d))) return fail(400, "Unknown document type");
  if (b.sitePin !== undefined && !/^\d{4}$/.test(b.sitePin)) return fail(400, "Site PIN must be 4 digits");

  Object.assign(site, b);
  audit(c.user.name, "site.updated", `${site.name} · ${Object.keys(b).join(", ")}`);
  return ok(site);
}
