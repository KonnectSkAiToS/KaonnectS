import { db } from "@/lib/data";
import { ctx, ok } from "@/lib/server";

export function GET(req: Request) {
  const c = ctx(req);
  return ok(
    db.clients
      .filter((cl) => c.clientIds.has(cl.id))
      .map((cl) => ({ ...cl, sites: db.sites.filter((s) => s.clientId === cl.id) })),
  );
}
