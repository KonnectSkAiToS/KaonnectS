import type { DB } from "./data";
import type { Candidate, ComplianceStatus, DocType, Shift, Site, Skill, Worker } from "./types";


export const WTR_MAX_HOURS = 48;
// UK National Living Wage from April 2025. Update each April.
export const MIN_PAY_RATE = 12.21;
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

  const leave = leaveOverlapping(db, w.id, shift);
  if (leave) reasons.push(`On approved ${leave.type} ${leave.from === leave.to ? leave.from : `${leave.from} to ${leave.to}`}`);

  const week = weekHours(db, w.id, shift.start, shift.id);
  if (week + hours(shift) > WTR_MAX_HOURS)
    reasons.push(`WTR: would reach ${week + hours(shift)}h this week (max ${WTR_MAX_HOURS}h)`);

  return [...new Set(reasons)];
}

/** Local calendar date YYYY-MM-DD (leave is booked in whole local days). */
export function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function leaveClashes(l: { from: string; to: string }, shift: { start: string; end: string }) {
  const from = localDate(shift.start);
  const to = localDate(new Date(Date.parse(shift.end) - 1).toISOString());
  return l.from <= to && l.to >= from;
}

export function leaveOverlapping(db: DB, workerId: string, shift: { start: string; end: string }) {
  return db.leave.find((l) => l.workerId === workerId && l.status === "approved" && leaveClashes(l, shift));
}

/** Booked future shifts that a leave request would clash with if approved. */
export function leaveConflicts(db: DB, l: { workerId: string; from: string; to: string }) {
  return db.shifts.filter(
    (s) => s.workerId === l.workerId && ["assigned", "confirmed"].includes(s.status) && leaveClashes(l, s),
  );
}

export const HOLIDAY_ACCRUAL_RATE = 0.1207; // 5.6 weeks / 46.4 working weeks
export const LEAVE_DAY_HOURS = 8;

export const leaveDays = (l: { from: string; to: string }) =>
  Math.round((Date.parse(l.to) - Date.parse(l.from)) / DAY) + 1;

/** Statutory holiday for PAYE / zero-hours workers accrues at 12.07% of hours worked. */
export function leaveBalance(db: DB, w: Worker) {
  const eligible = w.contractType !== "Umbrella";
  const worked = db.timesheets.filter((t) => t.workerId === w.id && t.status === "approved").reduce((a, t) => a + t.hours, 0);
  const accruedHours = eligible ? w.leaveOpeningHours + worked * HOLIDAY_ACCRUAL_RATE : 0;
  const usedHours = db.leave
    .filter((l) => l.workerId === w.id && l.type === "holiday" && l.status === "approved")
    .reduce((a, l) => a + leaveDays(l) * LEAVE_DAY_HOURS, 0);
  const r = (n: number) => Math.round(n * 10) / 10;
  return { eligible, accruedHours: r(accruedHours), usedHours: r(usedHours), remainingHours: r(accruedHours - usedHours) };
}

export const LATE_GRACE_MINS = 10;

/**
 * Reliability over the last 60 days: start at 100, -20 per no-show, -5 per late check-in.
 * Workers with no history get a neutral 75.
 * ponytail: fixed weights, tune once real attendance data exists.
 */
export function reliabilityOf(db: DB, workerId: string) {
  const since = Date.now() - 60 * DAY;
  const shifts = db.shifts.filter(
    (s) => s.workerId === workerId && Date.parse(s.start) > since && ["completed", "in_progress", "no_show"].includes(s.status),
  );
  if (!shifts.length) return 75;
  const noShows = shifts.filter((s) => s.status === "no_show").length;
  const late = shifts.filter((s) => {
    const inEv = db.attendance.find((a) => a.shiftId === s.id && a.kind === "in");
    return inEv && Date.parse(inEv.at) > Date.parse(s.start) + LATE_GRACE_MINS * 6e4;
  }).length;
  return Math.max(0, Math.min(100, 100 - noShows * 20 - late * 5));
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
