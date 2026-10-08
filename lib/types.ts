export type Role = "super_admin" | "coordinator" | "client_admin";

/** A job role name. Roles are configured per agency under Configuration → Job roles. */
export type Skill = string;

export type DocType =
  | "Right to Work"
  | "References"
  | "DBS Enhanced"
  | "Manual Handling"
  | "Safeguarding"
  | "Food Hygiene";

export type ContractType = "PAYE" | "Zero-hours" | "Umbrella";

export interface Client {
  id: string;
  name: string;
  sector: "care" | "hospitality";
  contact: string;
  email: string;
}

export interface Site {
  id: string;
  clientId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusM: number;
  sitePin: string;
  requiredDocs: DocType[];
}

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  skills: Skill[];
  contractType: ContractType;
  availableDays: string[]; // "Mon".."Sun"
  reliability: number; // 0-100, recomputed from attendance history (rules.reliabilityOf)
  leaveOpeningHours: number; // holiday accrued before this system went live
}

export type DocStatus = "pending" | "verified" | "rejected";

export interface WorkerDocument {
  id: string;
  workerId: string;
  type: DocType;
  fileName: string;
  status: DocStatus;
  uploadedAt: string;
  expiresOn: string | null;
  sizeKb?: number;
  lastRemindedAt?: string;
}

export type ShiftStatus =
  | "open"
  | "applied"
  | "assigned"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Shift {
  id: string;
  siteId: string;
  role: Skill;
  start: string;
  end: string;
  payRate?: number;
  billRate?: number;
  urgent: boolean;
  status: ShiftStatus;
  workerId: string | null;
  applicants: string[];
}

export interface ShiftView extends Shift {
  siteName: string;
  clientId: string;
  workerName: string | null;
}

export interface AttendanceEvent {
  id: string;
  shiftId: string;
  workerId: string;
  kind: "in" | "out";
  at: string;
  distanceM: number;
  method: "gps" | "manual" | "pin";
  status: "accepted" | "pending" | "rejected";
  reason?: string;
  offlineSynced: boolean;
}

export interface Timesheet {
  id: string;
  shiftId: string;
  workerId: string;
  siteId: string;
  date: string;
  hours: number;
  breakMins: number;
  payRate?: number;
  billRate?: number;
  status: "pending" | "approved" | "disputed";
  note?: string;
  syncedTo?: "Xero" | "Sage" | "BrightPay";
  invoiceId?: string;
}

export interface RateCard {
  id: string;
  clientId: string;
  role: Skill;
  dayType: "weekday" | "weekend" | "night";
  payRate?: number;
  billRate?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientIds: string[] | null; // null = all clients
  status: "active" | "invited" | "deactivated";
  invitedAt?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface Candidate {
  worker: Worker;
  reasons: string[];
  score: number;
  applied: boolean;
}

export type ComplianceStatus = "compliant" | "expiring" | "pending" | "blocked";

// ---- Phase 2 ----

export const LEAVE_TYPES = {
  holiday: { label: "Holiday", group: "Common", color: "green" },
  sick: { label: "Sick", group: "Common", color: "orange" },
  unavailable: { label: "Unavailable", group: "Common", color: "gray" },
  maternity: { label: "Maternity", group: "Family", color: "pink" },
  paternity: { label: "Paternity", group: "Family", color: "blue" },
  shared_parental: { label: "Shared parental", group: "Family", color: "violet" },
  adoption: { label: "Adoption", group: "Family", color: "purple" },
  parental: { label: "Parental (unpaid)", group: "Family", color: "iris" },
  dependants: { label: "Time off for dependants", group: "Family", color: "cyan" },
  compassionate: { label: "Compassionate / bereavement", group: "Other", color: "brown" },
  medical: { label: "Medical appointment", group: "Other", color: "red" },
  training: { label: "Training", group: "Other", color: "teal" },
  jury_service: { label: "Jury service / public duties", group: "Other", color: "indigo" },
  unpaid: { label: "Unpaid leave", group: "Other", color: "gold" },
} as const;
export type LeaveType = keyof typeof LEAVE_TYPES;

export interface LeaveRequest {
  id: string;
  workerId: string;
  type: LeaveType;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD inclusive
  status: "pending" | "approved" | "rejected";
  note?: string;
  requestedAt: string;
  decidedBy?: string;
}

export interface LeaveBalance {
  eligible: boolean; // umbrella workers have no statutory holiday accrual
  accruedHours: number;
  usedHours: number;
  remainingHours: number;
}

export interface Conversation {
  id: string;
  workerId: string;
  shiftId: string | null;
  subject: string;
}

export interface Message {
  id: string;
  conversationId: string;
  from: "agency" | "worker";
  author: string;
  body: string;
  at: string;
}

export type PayrollProvider = "Xero" | "Sage" | "BrightPay";

export interface PayrollConnection {
  provider: PayrollProvider;
  connected: boolean;
  orgName?: string;
  connectedAt?: string;
}

export interface PayrollSync {
  id: string;
  provider: PayrollProvider;
  at: string;
  lines: number;
  grossPay: number;
  status: "success" | "failed";
  message: string;
  by: string;
}

// ---- Phase 3 ----

export interface InvoiceLine {
  timesheetId: string;
  date: string;
  workerName: string;
  siteName: string;
  role: string;
  hours: number;
  rate: number;
  amount: number;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "void";

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  periodFrom: string; // YYYY-MM-DD
  periodTo: string;
  createdAt: string;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  subtotal: number;
  vat: number;
  total: number;
}

export type Plan = "starter" | "growth" | "enterprise";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  brandColor: "indigo" | "teal" | "crimson" | "amber" | "violet" | "green" | "blue" | "orange";
  plan: Plan;
  status: "active" | "trial" | "suspended";
  createdAt: string;
  adminEmail: string;
}

// ---- Settings ----

export type NotificationEvent =
  | "shift.matched" | "shift.confirmed" | "shift.cancelled" | "shift.reminder"
  | "document.expiring" | "leave.decided" | "timesheet.approved";

export interface NotificationTemplate {
  id: string;
  event: NotificationEvent;
  channel: "push" | "sms" | "email";
  subject?: string; // email only
  body: string;
  enabled: boolean;
}

export interface RetentionRule {
  id: string;
  category: string;
  months: number;
  basis: string; // what the period counts from
}

// ---- Configuration ----

export interface JobRole {
  id: string;
  name: string;
  sector: "care" | "hospitality" | "any";
  description: string | null;
  requiredDocs: string[];
  defaultPayRate: number | null;
  active: boolean;
  usage: { workers: number; upcomingShifts: number; rateCards: number };
}
