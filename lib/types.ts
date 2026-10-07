export type Role = "super_admin" | "coordinator" | "client_admin";

export type Skill =
  | "Carer"
  | "Senior Carer"
  | "Nurse"
  | "Kitchen Porter"
  | "Waiting Staff"
  | "Housekeeping"
  | "Chef";

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

export type LeaveType = "holiday" | "unavailable" | "sick";

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
