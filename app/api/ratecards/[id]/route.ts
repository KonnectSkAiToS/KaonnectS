import { audit, db } from "@/lib/data";
import { MIN_PAY_RATE } from "@/lib/rules";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";

/** Only Super Admin edits rates. Existing shifts keep the rate they were posted with. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const { id } = await params;
  const rc = db.rateCards.find((r) => r.id === id);
  if (!rc) return fail(404, "Rate card not found");
  const b = await body<{ payRate: number; billRate: number }>(req);
  const pay = Number(b.payRate), bill = Number(b.billRate);
  if (!Number.isFinite(pay) || !Number.isFinite(bill)) return fail(400, "Enter both rates");
  if (pay < MIN_PAY_RATE) return fail(422, `Pay rate is below the minimum of £${MIN_PAY_RATE.toFixed(2)}/h`);
  if (bill < pay) return fail(422, "Bill rate can't be lower than pay rate");
  if (bill > 200 || pay > 200) return fail(400, "Rates look too high. Check for a typo.");

  const client = db.clients.find((x) => x.id === rc.clientId)!;
  audit(c.user.name, "rate_card.updated", `${client.name} · ${rc.role} ${rc.dayType} · pay £${rc.payRate}→£${pay}, bill £${rc.billRate}→£${bill}`);
  Object.assign(rc, { payRate: +pay.toFixed(2), billRate: +bill.toFixed(2) });
  return ok(rc);
}
