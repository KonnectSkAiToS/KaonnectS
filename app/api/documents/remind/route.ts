import { audit, db } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";

const COOLDOWN_HOURS = 24;

/** Bulk "your document is expiring" reminders. Skips anyone reminded in the last 24h. */
export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role === "client_admin") return forbidden();
  const { documentIds } = await body<{ documentIds: string[] }>(req);
  if (!documentIds?.length) return fail(400, "Select at least one document");

  const now = Date.now();
  const docs = db.documents.filter((d) => documentIds.includes(d.id));
  const due = docs.filter((d) => !d.lastRemindedAt || now - Date.parse(d.lastRemindedAt) > COOLDOWN_HOURS * 36e5);
  // ponytail: delivery is simulated; production queues the document.expiring template on push/SMS/email.
  for (const d of due) d.lastRemindedAt = new Date(now).toISOString();
  if (due.length) audit(c.user.name, "document.reminders_sent", `${due.length} reminder(s)`);
  return ok({ sent: due.length, skipped: docs.length - due.length });
}
