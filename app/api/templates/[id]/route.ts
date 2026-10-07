import { audit, db } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";

const LIMIT = { push: 178, sms: 160, email: 5000 } as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role !== "super_admin") return forbidden();
  const { id } = await params;
  const t = db.templates.find((x) => x.id === id);
  if (!t) return fail(404, "Template not found");
  const b = await body<{ body?: string; subject?: string; enabled?: boolean }>(req);

  if (b.body !== undefined) {
    if (!b.body.trim()) return fail(400, "Message can't be empty");
    if (b.body.length > LIMIT[t.channel]) return fail(400, `${t.channel.toUpperCase()} messages are limited to ${LIMIT[t.channel]} characters`);
    const unknown = [...b.body.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).filter((v) => !VARIABLES.includes(v));
    if (unknown.length) return fail(400, "Unknown placeholder", unknown.map((v) => `{{${v}}}`));
  }
  if (t.channel === "email" && b.subject !== undefined && !b.subject.trim()) return fail(400, "Email subject can't be empty");

  Object.assign(t, { body: b.body ?? t.body, subject: b.subject ?? t.subject, enabled: b.enabled ?? t.enabled });
  audit(c.user.name, "template.updated", `${t.event} (${t.channel})${b.enabled !== undefined ? ` · ${b.enabled ? "enabled" : "disabled"}` : ""}`);
  return ok(t);
}

const VARIABLES = ["role", "site", "date", "start", "end", "agency", "workerName", "document", "expiry", "leaveType", "dates", "decision", "hours"];
