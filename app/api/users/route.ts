import { db } from "@/lib/data";
import { ctx, forbidden, ok } from "@/lib/server";

export function GET(req: Request) {
  if (ctx(req).role !== "super_admin") return forbidden();
  return ok(db.users.map((u) => ({ ...u, clients: u.clientIds?.map((id) => db.clients.find((c) => c.id === id)!.name) ?? ["All clients"] })));
}
