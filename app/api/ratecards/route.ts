import { db } from "@/lib/data";
import { ctx, ok, redact } from "@/lib/server";

export function GET(req: Request) {
  const c = ctx(req);
  return ok(
    db.rateCards
      .filter((r) => c.clientIds.has(r.clientId))
      .map((r) => redact(c, { ...r, clientName: db.clients.find((x) => x.id === r.clientId)!.name })),
  );
}
