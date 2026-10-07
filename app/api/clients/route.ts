import { audit, db, defaultRateCards } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { Client } from "@/lib/types";

export function GET(req: Request) {
  const c = ctx(req);
  return ok(
    db.clients
      .filter((cl) => c.clientIds.has(cl.id))
      .map((cl) => ({ ...cl, sites: db.sites.filter((s) => s.clientId === cl.id) })),
  );
}

export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const b = await body<{ name: string; sector: Client["sector"]; contact: string; email: string }>(req);
  if (!b.name?.trim() || !b.contact?.trim()) return fail(400, "Client name and contact are required");
  if (b.sector !== "care" && b.sector !== "hospitality") return fail(400, "Choose a sector");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email ?? "")) return fail(400, "Enter a valid email");
  if (db.clients.some((x) => x.name.toLowerCase() === b.name.trim().toLowerCase())) return fail(409, "A client with that name already exists");

  const client: Client = { id: `c${db.clients.length + 1}`, name: b.name.trim(), sector: b.sector, contact: b.contact.trim(), email: b.email.trim() };
  db.clients.push(client);
  db.rateCards.push(...defaultRateCards(client, db.rateCards.length)); // start from standard rates; edit later
  audit(c.user.name, "client.created", `${client.name} (${client.sector})`);
  return ok({ ...client, sites: [] }, 201);
}
