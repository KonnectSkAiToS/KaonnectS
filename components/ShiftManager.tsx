"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge, Box, Button, Callout, Card, Checkbox, DataList, Dialog, Flex, Grid, Heading, Select, Switch, Table, Text, TextArea, TextField,
} from "@radix-ui/themes";
import { InfoCircledIcon, LockClosedIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtDateTime, fmtHours, fmtMoney, fmtTime, ukDate, useApi, useRole, useSend } from "@/lib/client";
import { ErrorCallout, Load, ShiftBadge, StatusBadge } from "@/components/ui";
import { SKILLS } from "@/app/shifts/NewShiftDialog";
import type { ShiftView } from "@/lib/types";

type Shift = ShiftView & { notes: string | null };
interface Candidate { worker: { id: string; name: string; skills: string[]; reliability: number; contractType: string }; reasons: string[]; score: number; applied: boolean }
interface Detail {
  shift: Shift;
  site: { id: string; name: string; address: string; radiusM: number; requiredDocs: string[] };
  candidates: Candidate[];
  attendance: { id: string; kind: "in" | "out"; at: string; method: string; distanceM: number | null; status: string; reason: string | null }[];
  timesheet: { id: string; hours: number; status: string; note: string | null } | null;
  history: { at: string; label: string; actor: string | null; detail: string | null }[];
}

const UPCOMING = ["open", "applied", "assigned", "confirmed"];
const LOCKED: Record<string, string> = {
  completed: "This shift is completed and locked. Its hours are on the timesheet, which feeds payroll and invoicing, so corrections are made there.",
  no_show: "This shift was marked as a no-show and is locked.",
  cancelled: "This shift was cancelled and is locked.",
  in_progress: "This shift is in progress. It locks when the worker checks out.",
};

/** Full view and actions for one shift. Used by the shift page and the Rota side panel. */
export function ShiftManager({ id, onChanged, compact = false }: { id: string; onChanged?: () => void; compact?: boolean }) {
  const { role } = useRole();
  const send = useSend();
  const { data, error, reload } = useApi<Detail>(`/shifts/${id}`);
  const [actionError, setActionError] = useState<ApiError>();
  const [notice, setNotice] = useState<string>();
  useEffect(() => { setActionError(undefined); setNotice(undefined); }, [id]);

  async function act(path: string, method: string, body: unknown, done?: string) {
    try {
      setActionError(undefined);
      const res = await send<{ filled?: number }>(path, method, body);
      setNotice(done ?? (res?.filled === 0 ? "Nobody bookable for this shift." : undefined));
      reload();
      onChanged?.();
    } catch (e) {
      setNotice(undefined);
      setActionError(e as ApiError);
    }
  }

  return (
    <Load data={data} error={error}>
      {({ shift: s, site, candidates, attendance, timesheet, history }) => {
        const agency = role !== "client_admin";
        const upcoming = UPCOMING.includes(s.status) && Date.parse(s.start) > Date.now();
        const canAssign = agency && ["open", "applied"].includes(s.status) && upcoming;
        return (
          <Flex direction="column" gap="4">
            <Flex justify="between" align="start" gap="3" wrap="wrap">
              <div>
                <Heading size={compact ? "4" : "6"}>{s.role} · {s.siteName}</Heading>
                <Text size="2" color="gray">{fmtDate(s.start)}, {fmtTime(s.start)}–{fmtTime(s.end)} (UK time)</Text>
              </div>
              <Flex gap="2" wrap="wrap">
                {upcoming && <EditShift shift={s} onSaved={() => { reload(); onChanged?.(); setNotice("Shift updated."); }} />}
                {canAssign && candidates.some((c) => !c.reasons.length) && (
                  <Button onClick={() => act("/shifts/autofill", "POST", { shiftIds: [s.id] }, "Assigned the best-matched bookable worker.")}>Auto-fill</Button>
                )}
                {agency && s.status === "assigned" && <Button variant="soft" onClick={() => act(`/shifts/${s.id}`, "PATCH", { action: "confirm" })}>Mark confirmed</Button>}
                {agency && upcoming && ["assigned", "confirmed"].includes(s.status) && <Button variant="soft" color="gray" onClick={() => act(`/shifts/${s.id}`, "PATCH", { action: "unassign" })}>Unassign</Button>}
                {agency && ["confirmed", "in_progress"].includes(s.status) && Date.parse(s.start) <= Date.now() && (
                  <Button variant="soft" color="red" onClick={() => act(`/shifts/${s.id}`, "PATCH", { action: "no_show" })}>Mark no-show</Button>
                )}
                {upcoming && <Button color="red" variant="outline" onClick={() => confirm("Cancel this shift?") && act(`/shifts/${s.id}`, "PATCH", { action: "cancel" })}>Cancel shift</Button>}
              </Flex>
            </Flex>

            {LOCKED[s.status] && (
              <Callout.Root color={s.status === "in_progress" ? "blue" : "gray"}>
                <Callout.Icon><LockClosedIcon /></Callout.Icon>
                <Callout.Text>
                  {LOCKED[s.status]}{" "}
                  {timesheet && <Link href="/timesheets">Open timesheets ({fmtHours(timesheet.hours)}, {timesheet.status}) →</Link>}
                </Callout.Text>
              </Callout.Root>
            )}
            <ErrorCallout error={actionError} />
            {notice && <Callout.Root color="green"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>{notice}</Callout.Text></Callout.Root>}

            <Grid columns={{ initial: "1", md: compact ? "1" : "3" }} gap="3">
              <Card>
                <DataList.Root size="2">
                  <DataList.Item><DataList.Label>Status</DataList.Label><DataList.Value><Flex gap="1"><ShiftBadge status={s.status} />{s.urgent && <Badge color="red">urgent</Badge>}</Flex></DataList.Value></DataList.Item>
                  <DataList.Item><DataList.Label>Worker</DataList.Label><DataList.Value>{s.workerId ? <Link href={`/workers/${s.workerId}`}>{s.workerName}</Link> : "Not assigned"}</DataList.Value></DataList.Item>
                  {s.payRate !== undefined && s.payRate !== null && <DataList.Item><DataList.Label>Pay rate</DataList.Label><DataList.Value>{fmtMoney(s.payRate)}/h</DataList.Value></DataList.Item>}
                  {s.billRate !== undefined && s.billRate !== null && <DataList.Item><DataList.Label>Bill rate</DataList.Label><DataList.Value>{fmtMoney(s.billRate)}/h</DataList.Value></DataList.Item>}
                  {s.notes && <DataList.Item><DataList.Label>Notes</DataList.Label><DataList.Value><Text style={{ whiteSpace: "pre-wrap" }}>{s.notes}</Text></DataList.Value></DataList.Item>}
                </DataList.Root>
              </Card>
              <Card>
                <DataList.Root size="2">
                  <DataList.Item><DataList.Label>Address</DataList.Label><DataList.Value>{site.address}</DataList.Value></DataList.Item>
                  <DataList.Item><DataList.Label>Geofence</DataList.Label><DataList.Value>{site.radiusM} m radius</DataList.Value></DataList.Item>
                  <DataList.Item><DataList.Label>Required docs</DataList.Label><DataList.Value><Flex gap="1" wrap="wrap">{site.requiredDocs.map((d) => <Badge key={d} color="gray">{d}</Badge>)}</Flex></DataList.Value></DataList.Item>
                </DataList.Root>
              </Card>
              <Card>
                <Heading size="2" mb="2">Attendance</Heading>
                {attendance.length ? attendance.map((a) => (
                  <Text as="p" size="2" key={a.id} mb="1">
                    Checked {a.kind} {fmtDateTime(a.at)} · {a.method}{a.method !== "manual" && a.distanceM != null && ` · ${a.distanceM} m`} <StatusBadge status={a.status} />
                  </Text>
                )) : <Text size="2" color="gray">No check-ins yet.</Text>}
                {timesheet && <Text as="p" size="2" mt="2">Timesheet: {fmtHours(timesheet.hours)} <StatusBadge status={timesheet.status} /></Text>}
              </Card>
            </Grid>

            {candidates.length > 0 && <Candidates candidates={candidates} canAssign={agency && (canAssign || ["assigned", "confirmed"].includes(s.status))}
              reassign={!!s.workerId} onAssign={(w) => act(`/shifts/${s.id}/assign`, "POST", { workerId: w.id }, `${w.name} assigned.`)} />}

            <Card>
              <Heading size="3" mb="3">History</Heading>
              <Flex direction="column" gap="2">
                {history.map((h, i) => (
                  <Flex key={i} gap="3" align="start">
                    <Box mt="1" style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent-9)", flexShrink: 0 }} />
                    <Box>
                      <Text size="2" weight="medium">{h.label}</Text>
                      <Text as="div" size="1" color="gray">{fmtDateTime(h.at)}{h.actor && ` · ${h.actor}`}{h.detail && ` · ${h.detail}`}</Text>
                    </Box>
                  </Flex>
                ))}
              </Flex>
            </Card>
          </Flex>
        );
      }}
    </Load>
  );
}

/** Ranked candidates with search and a "bookable only" filter, so long pools stay usable. */
function Candidates({ candidates, canAssign, reassign, onAssign }: {
  candidates: Candidate[]; canAssign: boolean; reassign: boolean; onAssign: (w: Candidate["worker"]) => void;
}) {
  const [q, setQ] = useState("");
  const [bookableOnly, setBookableOnly] = useState(false);
  const shown = candidates.filter((c) => (!bookableOnly || !c.reasons.length) && c.worker.name.toLowerCase().includes(q.trim().toLowerCase()));
  const bookable = candidates.filter((c) => !c.reasons.length).length;
  return (
    <Card>
      <Flex justify="between" align="center" gap="3" wrap="wrap" mb="2">
        <div>
          <Heading size="3">{reassign ? "Reassign to" : "Candidates"}</Heading>
          <Text size="1" color="gray">{bookable} of {candidates.length} bookable · ranked by reliability, availability that day and whether they applied</Text>
        </div>
        <Flex gap="3" align="center">
          <TextField.Root size="1" placeholder="Search workers" value={q} onChange={(e) => setQ(e.target.value)}>
            <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
          </TextField.Root>
          <Text as="label" size="1"><Flex gap="1" align="center"><Switch size="1" checked={bookableOnly} onCheckedChange={setBookableOnly} /> Bookable only</Flex></Text>
        </Flex>
      </Flex>
      {!canAssign && <Text as="p" size="1" color="gray" mb="2">The agency makes assignments.</Text>}
      <Box style={{ maxHeight: 360, overflowY: "auto" }}>
        <Table.Root size="1">
          <Table.Body>
            {shown.map(({ worker: w, reasons, score, applied }) => (
              <Table.Row key={w.id}>
                <Table.Cell><Link href={`/workers/${w.id}`}>{w.name}</Link> {applied && <Badge color="amber">applied</Badge>}<Text as="div" size="1" color="gray">score {score}</Text></Table.Cell>
                <Table.Cell>{reasons.length ? <Flex direction="column" gap="1">{reasons.map((r) => <Text key={r} size="1" color="red">{r}</Text>)}</Flex> : <Badge color="green">bookable</Badge>}</Table.Cell>
                <Table.Cell justify="end">{canAssign && <Button size="1" disabled={reasons.length > 0} onClick={() => onAssign(w)}>{reassign ? "Reassign" : "Assign"}</Button>}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {!shown.length && <Text as="p" size="2" color="gray" m="2">No workers match.</Text>}
      </Box>
    </Card>
  );
}

/** Change date, time, role, urgency and notes. Re-checks an assigned worker against the new time. */
function EditShift({ shift, onSaved }: { shift: Shift; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const init = () => ({ date: ukDate(shift.start), startTime: fmtTime(shift.start), endTime: fmtTime(shift.end), role: shift.role as string, urgent: shift.urgent, notes: shift.notes ?? "" });
  const [f, setF] = useState(init);
  const roles: string[] = Object.values(SKILLS).find((list) => list.includes(shift.role)) ?? [shift.role];
  const blockedWorker = error?.status === 422 && !!shift.workerId;

  async function save(unassignIfBlocked = false) {
    try {
      await send(`/shifts/${shift.id}`, "PUT", { ...f, notes: f.notes.trim() || null, unassignIfBlocked });
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setF(init()); }}>
      <Dialog.Trigger><Button variant="soft">Edit</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Edit shift</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Times are UK time.{shift.workerId && ` ${shift.workerName} is assigned: a new time is re-checked against their compliance, other shifts, rest and weekly hours, and they'll need to re-confirm.`}
        </Dialog.Description>
        <ErrorCallout error={error} />
        <form onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Flex direction="column" gap="3">
            <label><Text as="div" size="2" weight="medium" mb="1">Date</Text><TextField.Root type="date" value={f.date} min={ukDate(new Date())} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <Flex gap="3">
              <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">Start</Text><TextField.Root type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></label>
              <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">End</Text><TextField.Root type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></label>
            </Flex>
            {f.endTime <= f.startTime && <Text size="1" color="gray">Ends the next morning (overnight shift).</Text>}
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Role</Text>
              <Select.Root value={f.role} onValueChange={(role) => setF({ ...f, role })}>
                <Select.Trigger style={{ width: "100%" }} />
                <Select.Content>{roles.map((r) => <Select.Item key={r} value={r}>{r}</Select.Item>)}</Select.Content>
              </Select.Root>
            </label>
            <label><Text as="div" size="2" weight="medium" mb="1">Notes for the worker</Text><TextArea rows={2} maxLength={1000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
            <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.urgent} onCheckedChange={(v) => setF({ ...f, urgent: v === true })} /> Urgent</Flex></Text>
          </Flex>
          <Flex gap="3" mt="5" justify="end" wrap="wrap">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            {blockedWorker && <Button type="button" color="orange" onClick={() => save(true)}>Save and release {shift.workerName}</Button>}
            <Button type="submit">Save</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
