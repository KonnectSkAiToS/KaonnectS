import type { DB } from "./data";
import type { Invoice, InvoiceLine, Plan } from "./types";
import { localDate } from "./rules";

export const VAT_RATE = 0.2;
export const PAYMENT_TERMS_DAYS = 14;

export const PLAN_LIMITS: Record<Plan, { workers: number; sites: number; price: number }> = {
  starter: { workers: 50, sites: 5, price: 149 },
  growth: { workers: 250, sites: 25, price: 499 },
  enterprise: { workers: Infinity, sites: Infinity, price: 1499 },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Approved, not-yet-invoiced timesheets for a client within the period, as invoice lines. */
export function billableLines(db: DB, clientId: string, from: string, to: string): InvoiceLine[] {
  const siteIds = new Set(db.sites.filter((s) => s.clientId === clientId).map((s) => s.id));
  return db.timesheets
    .filter((t) => siteIds.has(t.siteId) && t.status === "approved" && !t.invoiceId && t.date >= from && t.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const shift = db.shifts.find((s) => s.id === t.shiftId)!;
      return {
        timesheetId: t.id,
        date: t.date,
        workerName: db.workers.find((w) => w.id === t.workerId)!.name,
        siteName: db.sites.find((s) => s.id === t.siteId)!.name,
        role: shift.role,
        hours: round2(t.hours),
        rate: t.billRate!,
        amount: round2(t.hours * t.billRate!),
      };
    });
}

export function totals(lines: InvoiceLine[]) {
  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0));
  const vat = round2(subtotal * VAT_RATE);
  return { subtotal, vat, total: round2(subtotal + vat) };
}

/** Creates a draft invoice and marks its timesheets as invoiced so they can't be billed twice. */
export function createInvoice(db: DB, clientId: string, from: string, to: string): Invoice | null {
  const lines = billableLines(db, clientId, from, to);
  if (!lines.length) return null;
  const n = db.invoices.length + 1;
  const inv: Invoice = {
    id: `inv${n}`, number: `INV-${String(1000 + n)}`, clientId, periodFrom: from, periodTo: to,
    createdAt: new Date().toISOString(), status: "draft", lines, ...totals(lines),
    vatPct: VAT_RATE * 100, paymentTermsDays: PAYMENT_TERMS_DAYS,
  };
  for (const l of lines) db.timesheets.find((t) => t.id === l.timesheetId)!.invoiceId = inv.id;
  db.invoices.push(inv);
  return inv;
}

export function issueInvoice(inv: Invoice, at = new Date()) {
  inv.status = "issued";
  inv.issuedAt = at.toISOString();
  inv.dueDate = localDate(new Date(at.getTime() + PAYMENT_TERMS_DAYS * 864e5).toISOString());
}

/** Voiding frees the timesheets so they can be invoiced again. */
export function voidInvoice(db: DB, inv: Invoice) {
  inv.status = "void";
  for (const t of db.timesheets) if (t.invoiceId === inv.id) t.invoiceId = undefined;
}

export const isOverdue = (inv: Invoice) => inv.status === "issued" && !!inv.dueDate && inv.dueDate < localDate(new Date().toISOString());
