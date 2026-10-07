import { db } from "@/lib/data";
import { ctx, forbidden, ok } from "@/lib/server";

export function GET(req: Request) {
  if (ctx(req).role === "client_admin") return forbidden();
  return ok(db.documents.map((d) => ({ ...d, workerName: db.workers.find((w) => w.id === d.workerId)!.name })));
}
