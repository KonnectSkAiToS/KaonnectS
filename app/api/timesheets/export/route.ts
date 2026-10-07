import { audit, db } from "@/lib/data";
import { ctx, forbidden } from "@/lib/server";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function GET(req: Request) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const rows = db.timesheets
    .filter((t) => t.status === "approved")
    .map((t) => {
      const w = db.workers.find((x) => x.id === t.workerId)!;
      const s = db.sites.find((x) => x.id === t.siteId)!;
      const client = db.clients.find((x) => x.id === s.clientId)!;
      return [w.id, w.name, w.contractType, client.name, s.name, t.date, t.hours.toFixed(2), t.payRate, (t.hours * t.payRate!).toFixed(2), t.billRate, (t.hours * t.billRate!).toFixed(2)];
    });
  const header = ["worker_id", "worker", "contract", "client", "site", "date", "hours", "pay_rate", "gross_pay", "bill_rate", "bill_amount"];
  audit(c.user.name, "payrun.exported", `${rows.length} approved timesheet lines`);
  return new Response([header, ...rows].map((r) => r.map(cell).join(",")).join("\n"), {
    headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="payrun-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
