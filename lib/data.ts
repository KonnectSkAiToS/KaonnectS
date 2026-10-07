// Hardcoded in-memory data. Resets when the dev server restarts.
// ponytail: in-memory store, swap for the real API/Postgres when the backend exists.
import { BASE_DOCS, CARE_DOCS, HOSPITALITY_DOCS, bookingBlockers, hours, isCareWorker, localDate, reliabilityOf } from "./rules";
import type {
  AttendanceEvent, AuditEntry, Client, Conversation, LeaveRequest, Message, PayrollConnection, PayrollSync,
  RateCard, Shift, Site, Skill, Timesheet, User, Worker, WorkerDocument,
} from "./types";

export interface DB {
  clients: Client[];
  sites: Site[];
  workers: Worker[];
  documents: WorkerDocument[];
  shifts: Shift[];
  attendance: AttendanceEvent[];
  timesheets: Timesheet[];
  rateCards: RateCard[];
  users: User[];
  audit: AuditEntry[];
  leave: LeaveRequest[];
  conversations: Conversation[];
  messages: Message[];
  payrollConnections: PayrollConnection[];
  payrollSyncs: PayrollSync[];
}

// Deterministic PRNG so the data looks the same every restart.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

function at(dayOffset: number, h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const dateOnly = (dayOffset: number) => localDate(at(dayOffset, 12));

const NAMES = [
  "Amara Okafor", "Ben Hughes", "Chloe Patel", "Daniel Kowalski", "Ella Thompson", "Farah Hussain",
  "George Mensah", "Hannah Wright", "Isaac Nowak", "Jade Campbell", "Kwame Asante", "Lily Evans",
  "Mohammed Ali", "Nadia Rossi", "Oliver Grant", "Priya Nair", "Quinn Murphy", "Rosa Silva",
  "Samuel Owusu", "Tara Kelly", "Usman Rahman", "Vera Popescu", "Will Turner", "Yasmin Begum", "Zoe Clarke",
  "Adam Fischer", "Bella Moore", "Callum Reid", "Dina Haddad", "Ethan Brooks", "Fatima Zahra", "Gabriel Costa",
  "Holly Price", "Ifeoma Eze", "Jack Wilson", "Kiran Dhillon", "Leah Morgan", "Marek Novak", "Niamh Byrne", "Omar Farouk",
];
const CARE_SKILL_SETS: Skill[][] = [["Carer"], ["Carer", "Senior Carer"], ["Nurse"], ["Carer"]];
const HOSP_SKILL_SETS: Skill[][] = [["Kitchen Porter"], ["Waiting Staff"], ["Housekeeping"], ["Chef", "Kitchen Porter"], ["Waiting Staff", "Housekeeping"]];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function build(): DB {
  const clients: Client[] = [
    { id: "c1", name: "Oakwood Care Group", sector: "care", contact: "Helen Ward", email: "helen@oakwoodcare.example" },
    { id: "c2", name: "Riverside Hotels", sector: "hospitality", contact: "Marcus Lee", email: "marcus@riversidehotels.example" },
    { id: "c3", name: "Meadowbank Nursing", sector: "care", contact: "Sarah Doyle", email: "sarah@meadowbank.example" },
  ];

  const site = (id: string, clientId: string, name: string, address: string, lat: number, lng: number): Site => ({
    id, clientId, name, address, lat, lng, radiusM: 150, sitePin: String(1000 + Math.floor(rand() * 9000)),
    requiredDocs: clients.find((c) => c.id === clientId)!.sector === "care" ? [...CARE_DOCS] : [...HOSPITALITY_DOCS],
  });
  const sites: Site[] = [
    site("s1", "c1", "Oakwood House", "12 Park Lane, Leeds LS6 2AB", 53.8195, -1.5762),
    site("s2", "c1", "Oakwood Lodge", "48 Otley Road, Leeds LS16 5JT", 53.8402, -1.5821),
    site("s3", "c2", "Riverside Grand Hotel", "1 Quayside, Newcastle NE1 3DX", 54.9687, -1.6044),
    site("s4", "c2", "Riverside Quay Hotel", "22 The Close, Newcastle NE1 3RN", 54.9672, -1.6105),
    site("s5", "c3", "Meadowbank Manor", "7 Church Street, York YO1 8BE", 53.9614, -1.0819),
    site("s6", "c3", "Meadowbank Court", "90 Tadcaster Road, York YO24 1LR", 53.9455, -1.1050),
  ];
  sites[1].radiusM = 100;

  const workers: Worker[] = NAMES.map((name, i) => ({
    id: `w${i + 1}`,
    name,
    email: name.toLowerCase().replace(" ", ".") + "@mail.example",
    phone: `07${700 + i} ${String(100000 + i * 7919).slice(0, 6)}`,
    postcode: pick(["LS6", "LS16", "NE1", "NE6", "YO1", "YO24"]) + " " + (1 + i % 9) + "AB",
    skills: i < 14 || (i >= 25 && i < 35) ? CARE_SKILL_SETS[i % 4] : HOSP_SKILL_SETS[i % 5],
    contractType: pick(["PAYE", "Zero-hours", "Zero-hours", "Umbrella"] as const),
    availableDays: DAYS.filter(() => rand() > 0.3),
    reliability: 75,
    leaveOpeningHours: 40 + Math.floor(rand() * 80),
  }));

  // Documents: mostly valid; a few expired, expiring soon or pending to exercise the compliance rules.
  const documents: WorkerDocument[] = [];
  const special: Record<string, { type: string; expiresIn?: number; status?: "pending" | "rejected" }> = {
    w4: { type: "DBS Enhanced", expiresIn: -12 },
    w9: { type: "Manual Handling", expiresIn: 5 },
    w11: { type: "Safeguarding", expiresIn: 12 },
    w6: { type: "DBS Enhanced", expiresIn: 25 },
    w13: { type: "References", status: "pending" },
    w18: { type: "Food Hygiene", expiresIn: -3 },
    w21: { type: "Right to Work", expiresIn: 9 },
    w24: { type: "Food Hygiene", status: "pending" },
  };
  for (const w of workers) {
    for (const type of [...BASE_DOCS, ...(isCareWorker(w) ? CARE_DOCS : HOSPITALITY_DOCS)]) {
      const s = special[w.id]?.type === type ? special[w.id] : undefined;
      const expiresIn = s?.expiresIn ?? (type === "References" ? null : 120 + Math.floor(rand() * 600));
      documents.push({
        id: `d${documents.length + 1}`,
        workerId: w.id,
        type,
        fileName: `${type.toLowerCase().replace(/ /g, "-")}-${w.id}.pdf`,
        status: s?.status ?? "verified",
        uploadedAt: at(-30 - Math.floor(rand() * 200), 10),
        expiresOn: expiresIn === null ? null : dateOnly(expiresIn),
      });
    }
  }

  const rateCards: RateCard[] = [];
  const careRates: Partial<Record<Skill, number>> = { Carer: 12.6, "Senior Carer": 14, Nurse: 24 };
  const hospRates: Partial<Record<Skill, number>> = { "Kitchen Porter": 12.2, "Waiting Staff": 12.4, Housekeeping: 12.2, Chef: 15.5 };
  for (const c of clients) {
    for (const [role, base] of Object.entries(c.sector === "care" ? careRates : hospRates)) {
      for (const [dayType, uplift] of [["weekday", 1], ["weekend", 1.1], ["night", 1.15]] as const) {
        const payRate = +(base! * uplift).toFixed(2);
        rateCards.push({ id: `r${rateCards.length + 1}`, clientId: c.id, role: role as Skill, dayType, payRate, billRate: +(payRate * 1.32).toFixed(2) });
      }
    }
  }

  // Approved/pending leave is seeded before shifts so seeded bookings respect it.
  for (const id of ["w2", "w20", "w27", "w30"]) workers.find((w) => w.id === id)!.contractType = "PAYE"; // holiday needs an eligible contract
  const leave: LeaveRequest[] = [
    { id: "l1", workerId: "w2", type: "holiday", from: dateOnly(3), to: dateOnly(6), status: "approved", requestedAt: at(-20, 11), decidedBy: "Tom Reed", note: "Family wedding" },
    { id: "l2", workerId: "w27", type: "holiday", from: dateOnly(8), to: dateOnly(12), status: "pending", requestedAt: at(-2, 9), note: "Half-term with kids" },
    { id: "l3", workerId: "w16", type: "unavailable", from: dateOnly(1), to: dateOnly(2), status: "pending", requestedAt: at(-1, 19), note: "College exams" },
    { id: "l4", workerId: "w8", type: "sick", from: dateOnly(-3), to: dateOnly(-1), status: "approved", requestedAt: at(-3, 6), decidedBy: "Tom Reed" },
    { id: "l5", workerId: "w30", type: "holiday", from: dateOnly(14), to: dateOnly(20), status: "pending", requestedAt: at(-4, 14), note: "Trip to Poland" },
    { id: "l6", workerId: "w20", type: "holiday", from: dateOnly(-40), to: dateOnly(-36), status: "approved", requestedAt: at(-60, 10), decidedBy: "Priya Shah" },
    { id: "l7", workerId: "w11", type: "holiday", from: dateOnly(5), to: dateOnly(5), status: "rejected", requestedAt: at(-6, 10), decidedBy: "Tom Reed", note: "Short notice, site fully booked" },
  ];

  const db: DB = { clients, sites, workers, documents, shifts: [], attendance: [], timesheets: [], rateCards, audit: [], leave,
    conversations: [], messages: [], payrollSyncs: [],
    payrollConnections: [
      { provider: "Xero", connected: true, orgName: "Kaitos Staffing Ltd", connectedAt: at(-45, 10) },
      { provider: "Sage", connected: false },
      { provider: "BrightPay", connected: false },
    ],
    users: [
    { id: "u1", name: "Priya Shah", email: "priya@agency.example", role: "super_admin", clientIds: null },
    { id: "u2", name: "Tom Reed", email: "tom@agency.example", role: "coordinator", clientIds: ["c1", "c2"] },
    { id: "u3", name: "Helen Ward", email: "helen@oakwoodcare.example", role: "client_admin", clientIds: ["c1"] },
    { id: "u4", name: "Marcus Lee", email: "marcus@riversidehotels.example", role: "client_admin", clientIds: ["c2"] },
    { id: "u5", name: "Aisha Khan", email: "aisha@agency.example", role: "coordinator", clientIds: ["c3"] },
  ] };

  // Shifts from 3 weeks ago to 10 days ahead.
  const CARE_PATTERNS = [[7, 15, "Carer"], [14, 22, "Carer"], [8, 20, "Nurse"], [21, 31, "Senior Carer"]] as const;
  const HOSP_PATTERNS = [[6, 14, "Housekeeping"], [7, 15, "Kitchen Porter"], [17, 23, "Waiting Staff"], [12, 22, "Chef"]] as const;
  const now = Date.now();
  for (let day = -21; day <= 10; day++) {
    for (const s of sites) {
      const care = clients.find((c) => c.id === s.clientId)!.sector === "care";
      for (const [h1, h2, role] of care ? CARE_PATTERNS : HOSP_PATTERNS) {
        if (rand() < 0.45) continue;
        const start = at(day, h1);
        const end = at(day + Math.floor(h2 / 24), h2 % 24);
        const isNight = h1 >= 20;
        const weekend = [0, 6].includes(new Date(start).getDay());
        const rc = rateCards.find((r) => r.clientId === s.clientId && r.role === role && r.dayType === (isNight ? "night" : weekend ? "weekend" : "weekday"))!;
        db.shifts.push({
          id: `sh${db.shifts.length + 1}`, siteId: s.id, role, start, end, payRate: rc.payRate, billRate: rc.billRate,
          urgent: day >= 0 && day <= 2 && rand() < 0.3, status: "open", workerId: null, applicants: [],
        });
      }
    }
  }

  // Fill most shifts with a bookable worker, so the seeded data obeys the same rules as the API.
  for (const sh of db.shifts) {
    const future = Date.parse(sh.start) > now;
    if (future && rand() < 0.3) {
      const pool = workers.filter((w) => w.skills.includes(sh.role));
      sh.applicants = pool.filter(() => rand() < 0.2).map((w) => w.id);
      if (sh.applicants.length) sh.status = "applied";
      continue;
    }
    const s = sites.find((x) => x.id === sh.siteId)!;
    const w = workers.filter((w) => w.skills.includes(sh.role)).sort(() => rand() - 0.5).find((w) => bookingBlockers(db, w, sh, s).length === 0);
    if (!w) continue;
    sh.workerId = w.id;
    const started = Date.parse(sh.start) <= now;
    const ended = Date.parse(sh.end) <= now;
    sh.status = !started ? (rand() < 0.7 ? "confirmed" : "assigned") : ended ? (rand() < 0.06 ? "no_show" : "completed") : "in_progress";
    if (started && !ended && rand() < 0.08) sh.status = "no_show";
  }
  for (const sh of db.shifts) if (Date.parse(sh.start) < now && ["open", "applied"].includes(sh.status)) sh.status = "cancelled";

  // Attendance + timesheets for worked shifts.
  for (const sh of db.shifts) {
    if (!sh.workerId || !["in_progress", "completed"].includes(sh.status)) continue;
    const manual = sh.status === "in_progress" && rand() < 0.35;
    const offset = rand() < 0.12 ? 12 + Math.floor(rand() * 20) : Math.floor(rand() * 10) - 5; // some late arrivals
    db.attendance.push({
      id: `a${db.attendance.length + 1}`, shiftId: sh.id, workerId: sh.workerId, kind: "in",
      at: new Date(Date.parse(sh.start) + offset * 6e4).toISOString(),
      distanceM: manual ? 0 : Math.floor(rand() * 90), method: manual ? "manual" : rand() < 0.15 ? "pin" : "gps",
      status: manual ? "pending" : "accepted", reason: manual ? pick(["No GPS signal in basement", "Phone location services off", "GPS showed 400m away"]) : undefined,
      offlineSynced: !manual && rand() < 0.1,
    });
    if (sh.status !== "completed") continue;
    db.attendance.push({
      id: `a${db.attendance.length + 1}`, shiftId: sh.id, workerId: sh.workerId, kind: "out",
      at: sh.end, distanceM: Math.floor(rand() * 90), method: "gps", status: "accepted", offlineSynced: false,
    });
    const h = hours(sh);
    const breakMins = h > 6 ? 30 : 0;
    const ageDays = (now - Date.parse(sh.end)) / 864e5;
    db.timesheets.push({
      id: `t${db.timesheets.length + 1}`, shiftId: sh.id, workerId: sh.workerId, siteId: sh.siteId, date: sh.start.slice(0, 10),
      hours: h - breakMins / 60, breakMins, payRate: sh.payRate, billRate: sh.billRate,
      status: ageDays > 3 ? "approved" : rand() < 0.12 ? "disputed" : "pending",
    });
  }
  for (const t of db.timesheets) if (t.status === "disputed") t.note = "Worker left 45 minutes early according to the unit manager";

  for (const w of workers) w.reliability = reliabilityOf(db, w.id);

  // Message threads between coordinators and workers.
  const thread = (workerId: string, subject: string, shiftId: string | null, msgs: [("agency" | "worker"), string, number][]) => {
    const id = `cv${db.conversations.length + 1}`;
    db.conversations.push({ id, workerId, shiftId, subject });
    const w = workers.find((x) => x.id === workerId)!;
    for (const [from, body, minsAgo] of msgs)
      db.messages.push({ id: `m${db.messages.length + 1}`, conversationId: id, from, author: from === "agency" ? "Tom Reed" : w.name, body, at: new Date(now - minsAgo * 6e4).toISOString() });
  };
  const urgentOpen = db.shifts.find((s) => s.urgent && s.status === "open");
  const lateIn = db.attendance.find((a) => a.kind === "in" && a.status === "pending");
  thread("w6", "Can you cover tomorrow?", urgentOpen?.id ?? null, [
    ["agency", "Hi Farah, we have an urgent shift tomorrow. Are you free?", 180],
    ["worker", "Yes I can do it, what time does it start?", 150],
    ["agency", urgentOpen ? `${new Date(urgentOpen.start).toTimeString().slice(0, 5)} until ${new Date(urgentOpen.end).toTimeString().slice(0, 5)}. I'll book you in now.` : "I'll send the details over now.", 140],
  ]);
  if (lateIn) {
    const w = workers.find((x) => x.id === lateIn.workerId)!;
    thread(w.id, "Manual check-in today", lateIn.shiftId, [
      ["worker", `Hi, no signal in the basement so I couldn't check in with GPS. I'm on site.`, 95],
      ["agency", `Thanks ${w.name.split(" ")[0]}, I've flagged it to the site manager to approve.`, 80],
    ]);
  }
  thread("w27", "Holiday request", null, [
    ["worker", "I've put in a holiday request for half-term. Hope that's ok.", 60 * 26],
  ]);
  thread("w13", "References still pending", null, [
    ["agency", "Hi Mohammed, we're still waiting on your second reference. Can you chase your previous employer?", 60 * 50],
    ["worker", "Sorry, I'll call them today.", 60 * 48],
  ]);

  for (const t of db.timesheets) if (t.status === "approved" && Date.parse(t.date) < now - 7 * 864e5) t.syncedTo = "Xero";
  db.payrollSyncs = [
    { id: "ps1", provider: "Xero", at: at(-7, 17, 30), lines: 64, grossPay: 6420.5, status: "success", message: "Pay run created as draft in Xero", by: "Priya Shah" },
    { id: "ps2", provider: "Xero", at: at(-14, 17, 5), lines: 58, grossPay: 5933.2, status: "failed", message: "3 employees missing Xero employee IDs", by: "Priya Shah" },
  ];

  db.audit = [
    { id: "au1", at: at(-2, 9, 12), actor: "Priya Shah", action: "rate_card.updated", detail: "Riverside Hotels · Chef weekday pay £15.50" },
    { id: "au2", at: at(-1, 16, 40), actor: "Tom Reed", action: "document.verified", detail: "Amara Okafor · DBS Enhanced" },
    { id: "au3", at: at(-1, 18, 5), actor: "Helen Ward", action: "timesheet.approved", detail: "Oakwood House · 6 timesheets" },
  ];
  return db;
}

// Bump the key when the data shape changes so a running dev server reseeds.
const g = globalThis as unknown as { __staffingDbV5?: DB };
export const db: DB = (g.__staffingDbV5 ??= build());

export function audit(actor: string, action: string, detail: string) {
  db.audit.unshift({ id: `au${db.audit.length + 1}`, at: new Date().toISOString(), actor, action, detail });
}
