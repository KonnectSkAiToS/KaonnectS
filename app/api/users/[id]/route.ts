import { audit, db } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { Role, User } from "@/lib/types";

const ROLES: Role[] = ["super_admin", "coordinator", "client_admin"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const { id } = await params;
  const u = db.users.find((x) => x.id === id);
  if (!u) return fail(404, "User not found");
  const b = await body<{ role?: Role; clientIds?: string[]; status?: User["status"]; resendInvite?: boolean }>(req);

  if (u.id === c.user.id && (b.role || b.status === "deactivated")) return fail(409, "You can't change your own role or deactivate yourself");
  const role = b.role ?? u.role;
  if (!ROLES.includes(role)) return fail(400, "Unknown role");
  if (b.status && !["active", "deactivated"].includes(b.status)) return fail(400, "Status must be active or deactivated");
  // Keep at least one active Super Admin.
  const losingAdmin = u.role === "super_admin" && (role !== "super_admin" || b.status === "deactivated");
  if (losingAdmin && db.users.filter((x) => x.role === "super_admin" && x.status === "active" && x.id !== u.id).length === 0)
    return fail(409, "There must be at least one active Super Admin");

  const clientIds = role === "super_admin" ? null : (b.clientIds ?? u.clientIds ?? []).filter((cid) => db.clients.some((x) => x.id === cid));
  if (clientIds && !clientIds.length) return fail(400, "Choose at least one client for this role");

  if (b.resendInvite) {
    if (u.status !== "invited") return fail(409, "Only pending invites can be resent");
    u.invitedAt = new Date().toISOString();
    audit(c.user.name, "user.invite_resent", u.email);
    return ok(u);
  }
  Object.assign(u, { role, clientIds, status: b.status ?? u.status });
  audit(c.user.name, "user.updated", `${u.name} · ${role}${b.status ? ` · ${b.status}` : ""}`);
  return ok(u);
}
