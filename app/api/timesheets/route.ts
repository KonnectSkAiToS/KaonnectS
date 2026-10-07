import { db } from "@/lib/data";
import { ctx, ok, redact } from "@/lib/server";

export function GET(req: Request) {
  const c = ctx(req);
  return ok(
    db.timesheets
      .filter((t) => c.siteIds.has(t.siteId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) =>
        redact(c, {
          ...t,
          workerName: db.workers.find((w) => w.id === t.workerId)!.name,
          siteName: db.sites.find((s) => s.id === t.siteId)!.name,
        }),
      ),
  );
}
