import { audit, db } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { Role, User } from "@/lib/types";

const ROLES: Role[] = ["super_admin", "coordinator", "client_admin"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function GET(req: Request) {
  if (ctx(req).role !== "super_admin") return forbidden();
  return ok(db.users.map((u) => ({ ...u, clients: u.clientIds?.map((id) => db.clients.find((c) => c.id === id)?.name ?? id) ?? ["All clients"] })));
}

/** Invite a portal user. Super Admins see every client; others are scoped to the clients given. */
export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const b = await body<{ name: string; email: string; role: Role; clientIds?: string[] }>(req);
  if (!b.name?.trim()) return fail(400, "Name is required");
  if (!EMAIL.test(b.email ?? "")) return fail(400, "Enter a valid email");
  if (db.users.some((u) => u.email.toLowerCase() === b.email.toLowerCase())) return fail(409, "A user with that email already exists");
  if (!ROLES.includes(b.role)) return fail(400, "Choose a role");
  const clientIds = b.role === "super_admin" ? null : (b.clientIds ?? []).filter((id) => db.clients.some((x) => x.id === id));
  if (clientIds && !clientIds.length) return fail(400, "Choose at least one client for this role");

  const u: User = {
    id: `u${db.users.length + 1}`, name: b.name.trim(), email: b.email.trim(), role: b.role, clientIds,
    status: "invited", invitedAt: new Date().toISOString(),
  };
  db.users.push(u);
  audit(c.user.name, "user.invited", `${u.name} <${u.email}> as ${u.role}`);
  return ok(u, 201);
}
