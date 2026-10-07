import { audit, db } from "@/lib/data";
import { allow, body, ctx, fail, forbidden, ok } from "@/lib/server";

const MAX_MESSAGE = 2000;

export function GET(req: Request) {
  if (!allow(ctx(req), "super_admin", "coordinator")) return forbidden();
  return ok(
    db.conversations
      .map((cv) => {
        const msgs = db.messages.filter((m) => m.conversationId === cv.id);
        const last = msgs[msgs.length - 1];
        return { ...cv, workerName: db.workers.find((w) => w.id === cv.workerId)!.name, last, count: msgs.length };
      })
      .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? "")),
  );
}

export async function POST(req: Request) {
  const c = ctx(req);
  if (!allow(c, "super_admin", "coordinator")) return forbidden();
  const b = await body<{ workerId: string; subject: string; body: string; shiftId?: string }>(req);
  const w = db.workers.find((x) => x.id === b.workerId);
  if (!w) return fail(400, "Choose a worker");
  if (!b.subject?.trim() || !b.body?.trim()) return fail(400, "Subject and message are required");
  if (b.body.length > MAX_MESSAGE) return fail(400, `Message must be under ${MAX_MESSAGE} characters`);

  const id = `cv${db.conversations.length + 1}`;
  db.conversations.push({ id, workerId: w.id, subject: b.subject.trim(), shiftId: b.shiftId ?? null });
  db.messages.push({ id: `m${db.messages.length + 1}`, conversationId: id, from: "agency", author: c.user.name, body: b.body.trim(), at: new Date().toISOString() });
  audit(c.user.name, "message.sent", `${w.name} · ${b.subject.trim()}`);
  return ok({ id }, 201);
}
