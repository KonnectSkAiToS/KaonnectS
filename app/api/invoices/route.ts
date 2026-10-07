import { audit, db } from "@/lib/data";
import { billableLines, createInvoice, isOverdue, totals } from "@/lib/billing";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Super Admin sees every invoice; Client Admin sees their own (self-service billing). Coordinators have no access.
export function GET(req: Request) {
  const c = ctx(req);
  if (c.role === "coordinator") return forbidden();
  const list = db.invoices
    .filter((i) => c.clientIds.has(i.clientId) && (c.role === "super_admin" || i.status !== "draft"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ lines, ...i }) => ({
      ...i,
      lineCount: lines.length,
      clientName: db.clients.find((x) => x.id === i.clientId)!.name,
      overdue: isOverdue(i as typeof db.invoices[number]),
    }));
  const open = list.filter((i) => i.status === "issued");
  return ok({
    invoices: list,
    summary: {
      outstanding: open.reduce((a, i) => a + i.total, 0),
      overdue: open.filter((i) => i.overdue).reduce((a, i) => a + i.total, 0),
      paidLast30: list.filter((i) => i.status === "paid" && Date.parse(i.paidAt!) > Date.now() - 30 * 864e5).reduce((a, i) => a + i.total, 0),
      unbilledLines: c.role === "super_admin" ? db.timesheets.filter((t) => t.status === "approved" && !t.invoiceId && c.siteIds.has(t.siteId)).length : 0,
    },
  });
}

/** { clientId, from, to, preview? } — preview returns the lines without creating the draft. */
export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const b = await body<{ clientId: string; from: string; to: string; preview?: boolean }>(req);
  const client = db.clients.find((x) => x.id === b.clientId);
  if (!client) return fail(400, "Choose a client");
  if (!DATE.test(b.from ?? "") || !DATE.test(b.to ?? "") || b.to < b.from) return fail(400, "Enter a valid billing period");

  if (b.preview) {
    const lines = billableLines(db, client.id, b.from, b.to);
    return ok({ lines, ...totals(lines) });
  }
  const inv = createInvoice(db, client.id, b.from, b.to);
  if (!inv) return fail(409, "No approved, unbilled timesheets in that period");
  audit(c.user.name, "invoice.created", `${inv.number} · ${client.name} · ${inv.lines.length} lines`);
  return ok(inv, 201);
}
