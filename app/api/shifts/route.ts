import { audit, db } from "@/lib/data";
import { body, ctx, fail, ok, shiftView } from "@/lib/server";
import type { Skill } from "@/lib/types";

export function GET(req: Request) {
  const c = ctx(req);
  const q = new URL(req.url).searchParams;
  const from = q.get("from"), to = q.get("to"), status = q.get("status"), siteId = q.get("siteId");
  return ok(
    db.shifts
      .filter(
        (s) =>
          c.siteIds.has(s.siteId) &&
          (!from || s.start >= from) &&
          (!to || s.start < to) &&
          (!status || s.status === status) &&
          (!siteId || s.siteId === siteId),
      )
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((s) => shiftView(c, s)),
  );
}

interface NewShift { siteId: string; role: Skill; date: string; startTime: string; endTime: string; urgent?: boolean }

export async function POST(req: Request) {
  const c = ctx(req);
  const b = await body<NewShift>(req);
  const site = db.sites.find((s) => s.id === b.siteId);
  if (!site || !c.siteIds.has(site.id)) return fail(400, "Choose one of your sites");
  if (!b.role || !/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "") || !/^\d{2}:\d{2}$/.test(b.startTime ?? "") || !/^\d{2}:\d{2}$/.test(b.endTime ?? ""))
    return fail(400, "Role, date, start and end time are required");

  const start = new Date(`${b.date}T${b.startTime}`);
  const end = new Date(`${b.date}T${b.endTime}`);
  if (end <= start) end.setDate(end.getDate() + 1); // overnight shift
  if (start.getTime() < Date.now()) return fail(400, "Shift must start in the future");

  const dayType = start.getHours() >= 20 ? "night" : [0, 6].includes(start.getDay()) ? "weekend" : "weekday";
  const rc = db.rateCards.find((r) => r.clientId === site.clientId && r.role === b.role && r.dayType === dayType);
  if (!rc) return fail(400, `No rate card for ${b.role} at this client`);

  const shift = {
    id: `sh${db.shifts.length + 1}`, siteId: site.id, role: b.role, start: start.toISOString(), end: end.toISOString(),
    payRate: rc.payRate, billRate: rc.billRate, urgent: !!b.urgent, status: "open" as const, workerId: null, applicants: [],
  };
  db.shifts.push(shift);
  audit(c.user.name, "shift.posted", `${site.name} · ${b.role} · ${b.date} ${b.startTime}`);
  return ok(shiftView(c, shift), 201);
}
