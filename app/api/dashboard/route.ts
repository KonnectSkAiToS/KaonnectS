import { db } from "@/lib/data";
import { ctx, ok, shiftView } from "@/lib/server";

const FILLED = ["assigned", "confirmed", "in_progress", "completed"];

export function GET(req: Request) {
  const c = ctx(req);
  const shifts = db.shifts.filter((s) => c.siteIds.has(s.siteId));
  const now = Date.now();
  const sameDay = (iso: string, d: Date) => new Date(iso).toDateString() === d.toDateString();
  const today = shifts.filter((s) => sameDay(s.start, new Date()));

  const next7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const day = shifts.filter((s) => sameDay(s.start, d) && s.status !== "cancelled");
    return { day: d.toISOString(), total: day.length, filled: day.filter((s) => FILLED.includes(s.status)).length };
  });

  const urgent = shifts
    .filter((s) => ["open", "applied"].includes(s.status) && Date.parse(s.start) > now && Date.parse(s.start) < now + 3 * 864e5)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => shiftView(c, s));

  const complianceAlerts =
    c.role === "client_admin"
      ? []
      : db.documents
          .filter((d) => d.expiresOn && Date.parse(d.expiresOn) - now < 30 * 864e5)
          .map((d) => ({
            ...d,
            workerName: db.workers.find((w) => w.id === d.workerId)!.name,
            daysLeft: Math.ceil((Date.parse(d.expiresOn!) - now) / 864e5),
          }))
          .sort((a, b) => a.daysLeft - b.daysLeft);

  const shiftIds = new Set(shifts.map((s) => s.id));
  return ok({
    today: {
      total: today.filter((s) => s.status !== "cancelled").length,
      open: today.filter((s) => ["open", "applied"].includes(s.status)).length,
      filled: today.filter((s) => FILLED.includes(s.status)).length,
      inProgress: shifts.filter((s) => s.status === "in_progress").length,
      noShow: today.filter((s) => s.status === "no_show").length,
    },
    next7,
    urgent,
    complianceAlerts,
    pending: {
      timesheets: db.timesheets.filter((t) => shiftIds.has(t.shiftId) && t.status !== "approved").length,
      manualCheckins: db.attendance.filter((a) => shiftIds.has(a.shiftId) && a.status === "pending").length,
      documents: c.role === "client_admin" ? 0 : db.documents.filter((d) => d.status === "pending").length,
    },
  });
}
