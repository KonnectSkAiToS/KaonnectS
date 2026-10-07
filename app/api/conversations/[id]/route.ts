import { audit, db } from "@/lib/data";
import { allow, body, ctx, fail, forbidden, ok, shiftView } from "@/lib/server";

const MAX_MESSAGE = 2000;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (!allow(c, "super_admin", "coordinator")) return forbidden();
  const { id } = await params;
  const cv = db.conversations.find((x) => x.id === id);
  if (!cv) return fail(404, "Conversation not found");
  const shift = cv.shiftId ? db.shifts.find((s) => s.id === cv.shiftId) : undefined;
  return ok({
    conversation: cv,
    worker: db.workers.find((w) => w.id === cv.workerId),
    shift: shift ? shiftView(c, shift) : null,
    messages: db.messages.filter((m) => m.conversationId === id),
  });
}

// Messages are never edited or deleted: the thread is kept as CQC evidence.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (!allow(c, "super_admin", "coordinator")) return forbidden();
  const { id } = await params;
  const cv = db.conversations.find((x) => x.id === id);
  if (!cv) return fail(404, "Conversation not found");
  const { body: text } = await body<{ body: string }>(req);
  if (!text?.trim()) return fail(400, "Message is empty");
  if (text.length > MAX_MESSAGE) return fail(400, `Message must be under ${MAX_MESSAGE} characters`);
  const m = { id: `m${db.messages.length + 1}`, conversationId: id, from: "agency" as const, author: c.user.name, body: text.trim(), at: new Date().toISOString() };
  db.messages.push(m);
  audit(c.user.name, "message.sent", `${db.workers.find((w) => w.id === cv.workerId)!.name} · ${cv.subject}`);
  return ok(m, 201);
}
