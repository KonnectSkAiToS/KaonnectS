// Shared helpers for the dummy API route handlers.
import { db } from "./data";
import type { Role, Shift, ShiftView, User } from "./types";

export interface Ctx {
  role: Role;
  user: User;
  siteIds: Set<string>;
  clientIds: Set<string>;
}

// ponytail: role comes from an x-role header set by the role switcher; replace with real JWT auth.
export function ctx(req: Request): Ctx {
  const role = (req.headers.get("x-role") ?? "super_admin") as Role;
  const user = db.users.find((u) => u.role === role)!;
  const clientIds = new Set(user.clientIds ?? db.clients.map((c) => c.id));
  const siteIds = new Set(db.sites.filter((s) => clientIds.has(s.clientId)).map((s) => s.id));
  return { role, user, siteIds, clientIds };
}

export const ok = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (status: number, error: string, reasons?: string[]) => Response.json({ error, reasons }, { status });
export const forbidden = () => fail(403, "Your role does not have access to this.");

export function allow(c: Ctx, ...roles: Role[]) {
  return roles.includes(c.role);
}

/** Client Admins never see pay rates or margin; Coordinators never see bill rates. */
export function redact<T extends { payRate?: number; billRate?: number }>(c: Ctx, o: T): T {
  if (c.role === "client_admin") return { ...o, payRate: undefined };
  if (c.role === "coordinator") return { ...o, billRate: undefined };
  return o;
}

export function shiftView(c: Ctx, s: Shift): ShiftView {
  const site = db.sites.find((x) => x.id === s.siteId)!;
  return redact(c, {
    ...s,
    siteName: site.name,
    clientId: site.clientId,
    workerName: db.workers.find((w) => w.id === s.workerId)?.name ?? null,
  });
}

export async function body<T>(req: Request): Promise<T> {
  return (await req.json().catch(() => ({}))) as T;
}
