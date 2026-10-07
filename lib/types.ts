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
  reliability: number; // 0-100
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
