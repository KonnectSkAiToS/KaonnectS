import type { DB } from "./data";
import type { Candidate, ComplianceStatus, DocType, Shift, Site, Skill, Worker } from "./types";

export const WTR_MAX_HOURS = 48;
export const MIN_REST_HOURS = 11;
export const BASE_DOCS: DocType[] = ["Right to Work", "References"];
export const CARE_DOCS: DocType[] = ["DBS Enhanced", "Manual Handling", "Safeguarding"];
export const HOSPITALITY_DOCS: DocType[] = ["Food Hygiene"];
const CARE_SKILLS: Skill[] = ["Carer", "Senior Carer", "Nurse"];

const BOOKED = new Set(["assigned", "confirmed", "in_progress", "completed"]);
const DAY = 864e5;

export const hours = (s: { start: string; end: string }) =>
  (Date.parse(s.end) - Date.parse(s.start)) / 36e5;

export const isCareWorker = (w: Worker) => w.skills.some((s) => CARE_SKILLS.includes(s));

export function requiredDocsFor(w: Worker): DocType[] {
  return [...BASE_DOCS, ...(isCareWorker(w) ? CARE_DOCS : HOSPITALITY_DOCS)];
}

/** Documents that are missing, unverified or expired on the given date. */
export function missingDocs(db: DB, workerId: string, need: DocType[], atISO: string): DocType[] {
  const at = Date.parse(atISO);
  return [...new Set(need)].filter(
    (t) =>
      !db.documents.some(
        (d) =>
          d.workerId === workerId &&
          d.type === t &&
          d.status === "verified" &&
          (!d.expiresOn || Date.parse(d.expiresOn) >= at),
      ),
  );
}

export function complianceStatus(db: DB, w: Worker): ComplianceStatus {
  const now = new Date().toISOString();
  if (missingDocs(db, w.id, requiredDocsFor(w), now).length) return "blocked";
  const docs = db.documents.filter((d) => d.workerId === w.id);
  if (docs.some((d) => d.expiresOn && Date.parse(d.expiresOn) - Date.now() < 30 * DAY)) return "expiring";
  if (docs.some((d) => d.status === "pending")) return "pending";
  return "compliant";
}

function weekStart(iso: string) {
  const d = new Date(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function weekHours(db: DB, workerId: string, iso: string, excludeShiftId?: string) {
  const ws = weekStart(iso);
  return db.shifts
    .filter(
      (s) =>
        s.workerId === workerId &&
        s.id !== excludeShiftId &&
        BOOKED.has(s.status) &&
        Date.parse(s.start) >= ws &&
        Date.parse(s.start) < ws + 7 * DAY,
    )
    .reduce((t, s) => t + hours(s), 0);
}

/** Every reason this worker cannot be booked on this shift. Empty = bookable. */
export function bookingBlockers(db: DB, w: Worker, shift: Shift, site: Site): string[] {
  const reasons: string[] = [];
  if (!w.skills.includes(shift.role)) reasons.push(`No ${shift.role} skill`);

  const missing = missingDocs(db, w.id, [...BASE_DOCS, ...site.requiredDocs], shift.start);
  if (missing.length) reasons.push(`Compliance: ${missing.join(", ")} missing or expired`);

  const start = Date.parse(shift.start);
  const end = Date.parse(shift.end);
  const rest = MIN_REST_HOURS * 36e5;
  for (const o of db.shifts) {
    if (o.id === shift.id || o.workerId !== w.id || !BOOKED.has(o.status)) continue;
    const os = Date.parse(o.start);
    const oe = Date.parse(o.end);
    if (os < end && oe > start) {
      reasons.push(`Double-booking: already on a shift ${new Date(os).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`);
    } else if (os < end + rest && oe > start - rest) {
      reasons.push(`Less than ${MIN_REST_HOURS}h rest between shifts`);
    }
  }

  const week = weekHours(db, w.id, shift.start, shift.id);
  if (week + hours(shift) > WTR_MAX_HOURS)
    reasons.push(`WTR: would reach ${week + hours(shift)}h this week (max ${WTR_MAX_HOURS}h)`);

  return [...new Set(reasons)];
}

export function rankCandidates(db: DB, shift: Shift): Candidate[] {
  const site = db.sites.find((s) => s.id === shift.siteId)!;
  const day = new Date(shift.start).toLocaleDateString("en-GB", { weekday: "short" });
  return db.workers
    .filter((w) => w.skills.includes(shift.role))
    .map((worker) => {
      const reasons = bookingBlockers(db, worker, shift, site);
      const applied = shift.applicants.includes(worker.id);
      const score = worker.reliability + (worker.availableDays.includes(day) ? 20 : 0) + (applied ? 15 : 0);
      return { worker, reasons, score, applied };
    })
    .sort((a, b) => Number(a.reasons.length > 0) - Number(b.reasons.length > 0) || b.score - a.score);
}
