import { db } from "@/lib/data";
import { ctx, forbidden, ok } from "@/lib/server";

export function GET(req: Request) {
  if (ctx(req).role !== "super_admin") return forbidden();
  return ok(db.retention);
}
