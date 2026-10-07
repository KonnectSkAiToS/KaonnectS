import { audit, db } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = ctx(req);
  if (c.role === "client_admin") return forbidden();
  const { id } = await params;
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return fail(404, "Document not found");
  const { status } = await body<{ status: string }>(req);
  if (status !== "verified" && status !== "rejected") return fail(400, "Status must be verified or rejected");
  doc.status = status;
  const w = db.workers.find((x) => x.id === doc.workerId)!;
  audit(c.user.name, `document.${status}`, `${w.name} · ${doc.type}`);
  return ok(doc);
}
