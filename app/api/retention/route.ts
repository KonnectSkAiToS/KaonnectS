import { db } from "@/lib/data";
import { ctx, forbidden, ok } from "@/lib/server";

export function GET(req: Request) {
  // Super Admin edits; Coordinators can read the configuration.
  if (ctx(req).role === "client_admin") return forbidden();
  return ok(db.retention);
}
