// Dummy payroll provider integration. In production each provider is an adapter behind the same port.
import { audit, db } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { PayrollProvider } from "@/lib/types";

const PROVIDERS: PayrollProvider[] = ["Xero", "Sage", "BrightPay"];
const unsynced = () => db.timesheets.filter((t) => t.status === "approved" && !t.syncedTo);

export function GET(req: Request) {
  if (ctx(req).role !== "super_admin") return forbidden();
  const lines = unsynced();
  return ok({
    connections: db.payrollConnections,
    syncs: [...db.payrollSyncs].sort((a, b) => b.at.localeCompare(a.at)),
    ready: { lines: lines.length, grossPay: lines.reduce((a, t) => a + t.hours * t.payRate!, 0) },
  });
}

export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const { action, provider } = await body<{ action: string; provider: PayrollProvider }>(req);
  const conn = db.payrollConnections.find((p) => p.provider === provider);
  if (!PROVIDERS.includes(provider) || !conn) return fail(400, "Unknown payroll provider");

  if (action === "connect") {
    // ponytail: real flow is an OAuth redirect to the provider; this just flips the flag.
    Object.assign(conn, { connected: true, orgName: "Kaitos Staffing Ltd", connectedAt: new Date().toISOString() });
    audit(c.user.name, "payroll.connected", provider);
    return ok(conn);
  }
  if (action === "disconnect") {
    Object.assign(conn, { connected: false, orgName: undefined, connectedAt: undefined });
    audit(c.user.name, "payroll.disconnected", provider);
    return ok(conn);
  }
  if (action !== "sync") return fail(400, "Action must be connect, disconnect or sync");
  if (!conn.connected) return fail(409, `Connect ${provider} first`);

  const lines = unsynced();
  if (!lines.length) return fail(409, "No approved timesheets waiting to sync");
  for (const t of lines) t.syncedTo = provider;
  const sync = {
    id: `ps${db.payrollSyncs.length + 1}`, provider, at: new Date().toISOString(), lines: lines.length,
    grossPay: lines.reduce((a, t) => a + t.hours * t.payRate!, 0), status: "success" as const,
    message: `Pay run created as draft in ${provider}`, by: c.user.name,
  };
  db.payrollSyncs.push(sync);
  audit(c.user.name, "payroll.synced", `${provider} · ${lines.length} lines`);
  return ok(sync, 201);
}
