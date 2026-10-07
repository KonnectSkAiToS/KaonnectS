import { audit, db } from "@/lib/data";
import { ctx, forbidden } from "@/lib/server";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV of the audit log, for CQC inspections and disputes. ?from=YYYY-MM-DD&to=YYYY-MM-DD optional. */
export function GET(req: Request) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const q = new URL(req.url).searchParams;
  const from = q.get("from"), to = q.get("to");
  const rows = db.audit.filter((a) => (!from || a.at.slice(0, 10) >= from) && (!to || a.at.slice(0, 10) <= to));
  audit(c.user.name, "audit.exported", `${rows.length} entries${from || to ? ` (${from ?? "start"} to ${to ?? "today"})` : ""}`);
  const csv = [["when", "actor", "action", "detail"], ...rows.map((a) => [a.at, a.actor, a.action, a.detail])].map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
