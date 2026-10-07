import { db } from "@/lib/data";
import { ctx, ok, shiftView } from "@/lib/server";

export function GET(req: Request) {
  const c = ctx(req);
  const shifts = new Map(db.shifts.filter((s) => c.siteIds.has(s.siteId)).map((s) => [s.id, s]));
  const events = db.attendance
    .filter((a) => shifts.has(a.shiftId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((a) => {
      const s = shiftView(c, shifts.get(a.shiftId)!);
      return { ...a, workerName: s.workerName, siteName: s.siteName, shiftStart: s.start, shiftEnd: s.end };
    });
  const onShift = [...shifts.values()]
    .filter((s) => s.status === "in_progress")
    .map((s) => ({ shift: shiftView(c, s), checkIn: events.find((e) => e.shiftId === s.id && e.kind === "in") ?? null }));
  return ok({ events, onShift });
}
