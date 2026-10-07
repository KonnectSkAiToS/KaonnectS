import { audit, db } from "@/lib/data";
import { isOverdue, issueInvoice, voidInvoice } from "@/lib/billing";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role === "coordinator") return forbidden();
  const { id } = await params;
  const inv = db.invoices.find((i) => i.id === id && c.clientIds.has(i.clientId));
  if (!inv || (c.role === "client_admin" && inv.status === "draft")) return fail(404, "Invoice not found");
  const tenant = db.tenants.find((t) => t.id === db.currentTenantId)!;
  return ok({ invoice: { ...inv, overdue: isOverdue(inv) }, client: db.clients.find((x) => x.id === inv.clientId), agency: tenant });
}

const ALLOWED: Record<string, string[]> = { issue: ["draft"], mark_paid: ["issued"], void: ["draft", "issued"] };

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const { id } = await params;
  const inv = db.invoices.find((i) => i.id === id);
  if (!inv) return fail(404, "Invoice not found");
  const { action } = await body<{ action: string }>(req);
  if (!ALLOWED[action]?.includes(inv.status)) return fail(409, `Cannot ${action?.replace("_", " ") ?? "update"} a ${inv.status} invoice`);

  if (action === "issue") issueInvoice(inv);
  if (action === "mark_paid") Object.assign(inv, { status: "paid", paidAt: new Date().toISOString() });
  if (action === "void") voidInvoice(db, inv);
  audit(c.user.name, `invoice.${action}`, `${inv.number} · £${inv.total.toFixed(2)}`);
  return ok(inv);
}
