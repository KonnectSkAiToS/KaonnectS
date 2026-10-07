import { audit, db } from "@/lib/data";
import { body, ctx, fail, forbidden, ok } from "@/lib/server";
import type { DocType, WorkerDocument } from "@/lib/types";

export function GET(req: Request) {
  if (ctx(req).role === "client_admin") return forbidden();
  return ok(db.documents.map((d) => ({ ...d, workerName: db.workers.find((w) => w.id === d.workerId)!.name })));
}

const TYPES: DocType[] = ["Right to Work", "References", "DBS Enhanced", "Manual Handling", "Safeguarding", "Food Hygiene"];
const ALLOWED_EXT = /\.(pdf|jpe?g|png|heic)$/i;
const MAX_KB = 10 * 1024;

/**
 * Upload on a worker's behalf (normally done in the mobile app). Only metadata is kept here.
 * ponytail: no file storage in the demo; production uploads straight to S3 via a pre-signed URL.
 */
export async function POST(req: Request) {
  const c = ctx(req);
  if (c.role === "client_admin") return forbidden();
  const b = await body<{ workerId: string; type: DocType; expiresOn: string | null; fileName: string; sizeKb: number }>(req);
  const w = db.workers.find((x) => x.id === b.workerId);
  if (!w) return fail(400, "Choose a worker");
  if (!TYPES.includes(b.type)) return fail(400, "Choose a document type");
  if (!ALLOWED_EXT.test(b.fileName ?? "")) return fail(400, "File must be a PDF, JPG, PNG or HEIC");
  if (!(b.sizeKb > 0 && b.sizeKb <= MAX_KB)) return fail(400, "File must be under 10 MB");
  if (b.type !== "References" && !/^\d{4}-\d{2}-\d{2}$/.test(b.expiresOn ?? "")) return fail(400, "Enter the expiry date");

  const doc: WorkerDocument = {
    id: `d${db.documents.length + 1}`, workerId: w.id, type: b.type, fileName: b.fileName, sizeKb: Math.round(b.sizeKb),
    status: "pending", uploadedAt: new Date().toISOString(), expiresOn: b.type === "References" ? null : b.expiresOn,
  };
  db.documents.push(doc);
  audit(c.user.name, "document.uploaded", `${w.name} · ${b.type} · ${b.fileName}`);
  return ok(doc, 201);
}
