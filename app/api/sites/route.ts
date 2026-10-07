import { audit, db } from "@/lib/data";
import { CARE_DOCS, HOSPITALITY_DOCS } from "@/lib/rules";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { Site } from "@/lib/types";

export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const b = await body<{ clientId: string; name: string; address: string; lat: number; lng: number; radiusM: number }>(req);
  const client = db.clients.find((x) => x.id === b.clientId);
  if (!client) return fail(400, "Choose a client");
  if (!b.name?.trim() || !b.address?.trim()) return fail(400, "Site name and address are required");
  const lat = Number(b.lat), lng = Number(b.lng), radiusM = Number(b.radiusM ?? 150);
  // UK bounding box, roughly. Catches swapped or mistyped coordinates.
  if (!(lat >= 49.8 && lat <= 60.9 && lng >= -8.7 && lng <= 1.8)) return fail(400, "Coordinates must be in the UK (check latitude and longitude aren't swapped)");
  if (!(radiusM >= 50 && radiusM <= 500)) return fail(400, "Geofence radius must be between 50 and 500 m");

  const site: Site = {
    id: `s${db.sites.length + 1}`, clientId: client.id, name: b.name.trim(), address: b.address.trim(), lat, lng, radiusM,
    sitePin: String(1000 + Math.floor(Math.random() * 9000)),
    requiredDocs: client.sector === "care" ? [...CARE_DOCS] : [...HOSPITALITY_DOCS],
  };
  db.sites.push(site);
  audit(c.user.name, "site.created", `${client.name} · ${site.name}`);
  return ok(site, 201);
}
