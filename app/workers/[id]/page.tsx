"use client";
import { useState } from "react";
import { MultiSelect } from "@/components/MultiSelect";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Box, Button, Callout, Card, DataList, Dialog, Flex, Grid, Heading, Table, Text } from "@radix-ui/themes";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtHours, fmtTime, useApi, useRole, useRoles, useSend } from "@/lib/client";
import { WorkerCalendar } from "@/components/WorkerCalendar";
import { ComplianceBadge, Empty, ErrorCallout, Load, PageHeader, ShiftBadge, StatusBadge } from "@/components/ui";
import { WTR_MAX_HOURS } from "@/lib/rules";
import type { ComplianceStatus, DocType, LeaveBalance, LeaveRequest, ShiftView, Worker, WorkerDocument } from "@/lib/types";

interface Detail {
  worker: Worker; compliance: ComplianceStatus; missing: DocType[]; weekHours: number; documents: WorkerDocument[]; shifts: ShiftView[];
  leaveBalance: LeaveBalance; leave: LeaveRequest[];
}
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WorkerPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<Detail>(`/workers/${id}`);
  const { role } = useRole();
  return (
    <>
      <Link href="/workers" style={{ textDecoration: "none" }}><Text size="2" color="gray"><Flex align="center" gap="1" mb="3"><ArrowLeftIcon /> All workers</Flex></Text></Link>
      <Load data={data} error={error}>
        {({ worker: w, compliance, missing, weekHours, documents, shifts, leaveBalance, leave }) => (
          <>
            <PageHeader title={w.name} subtitle={w.skills.join(" · ")}>
              <ComplianceBadge status={compliance} />
              {role !== "client_admin" && <EditWorkerRoles workerId={w.id} name={w.name} current={w.skills} onSaved={reload} />}
            </PageHeader>
            {missing.length > 0 && (
              <Callout.Root color="red" mb="4">
                <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
                <Callout.Text>Cannot be booked. Missing or expired: {missing.join(", ")}.</Callout.Text>
              </Callout.Root>
            )}
            <Grid columns={{ initial: "1", md: "2" }} gap="4" mb="5">
              <Card>
                <DataList.Root>
                  <DataList.Item><DataList.Label>Email</DataList.Label><DataList.Value>{w.email}</DataList.Value></DataList.Item>
                  <DataList.Item><DataList.Label>Phone</DataList.Label><DataList.Value>{w.phone}</DataList.Value></DataList.Item>
                  <DataList.Item><DataList.Label>Postcode</DataList.Label><DataList.Value>{w.postcode}</DataList.Value></DataList.Item>
                  <DataList.Item><DataList.Label>Contract</DataList.Label><DataList.Value>{w.contractType}</DataList.Value></DataList.Item>
                  <DataList.Item><DataList.Label>Reliability</DataList.Label><DataList.Value>{w.reliability}%</DataList.Value></DataList.Item>
                </DataList.Root>
              </Card>
              <Card>
                <Heading size="2" mb="2">Availability</Heading>
                <Flex gap="1" mb="4">{DAYS.map((d) => <Badge key={d} color={w.availableDays.includes(d) ? "green" : "gray"} variant={w.availableDays.includes(d) ? "solid" : "soft"}>{d}</Badge>)}</Flex>
                <Heading size="2" mb="2">Hours this week</Heading>
                <div className="bar"><span style={{ width: `${Math.min(100, (weekHours / WTR_MAX_HOURS) * 100)}%`, background: weekHours > WTR_MAX_HOURS * 0.85 ? "var(--red-9)" : undefined }} /></div>
                <Text size="1" color="gray">{fmtHours(weekHours)} of {WTR_MAX_HOURS}h Working Time Regulations limit</Text>
                <Heading size="2" mt="4" mb="2">Holiday</Heading>
                {leaveBalance.eligible
                  ? <Text size="2">{leaveBalance.remainingHours}h remaining <Text color="gray">({leaveBalance.accruedHours}h accrued, {leaveBalance.usedHours}h used)</Text></Text>
                  : <Text size="2" color="gray">Umbrella contract: no statutory holiday accrual</Text>}
                {leave.map((l) => (
                  <Text as="div" size="1" key={l.id} mt="1">
                    <Badge color={l.status === "approved" ? "green" : "amber"}>{l.type} · {l.status}</Badge> {fmtDate(`${l.from}T00:00`)}{l.to !== l.from && ` – ${fmtDate(`${l.to}T00:00`)}`}
                  </Text>
                ))}
              </Card>
            </Grid>

            <Box mb="5"><WorkerCalendar workerId={w.id} /></Box>

            <Heading size="3" mb="2">Documents</Heading>
            <Card mb="5" style={{ overflowX: "auto" }}>
              <Table.Root size="1">
                <Table.Header><Table.Row>
                  <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Expires</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Uploaded</Table.ColumnHeaderCell>
                </Table.Row></Table.Header>
                <Table.Body>
                  {documents.map((d) => {
                    const expired = d.expiresOn && Date.parse(d.expiresOn) < Date.now();
                    return (
                      <Table.Row key={d.id}>
                        <Table.Cell>{d.type}</Table.Cell>
                        <Table.Cell><StatusBadge status={d.status} /></Table.Cell>
                        <Table.Cell>{d.expiresOn ? <Text color={expired ? "red" : undefined}>{fmtDate(d.expiresOn)}{expired && " (expired)"}</Text> : "No expiry"}</Table.Cell>
                        <Table.Cell>{fmtDate(d.uploadedAt)}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </Card>

            <Heading size="3" mb="2">Shifts</Heading>
            {shifts.length === 0 ? <Empty>No shifts.</Empty> : (
              <Card style={{ overflowX: "auto" }}>
                <Table.Root size="1">
                  <Table.Body>
                    {shifts.slice(0, 30).map((s) => (
                      <Table.Row key={s.id}>
                        <Table.Cell><Link href={`/shifts/${s.id}`}>{fmtDate(s.start)} {fmtTime(s.start)}–{fmtTime(s.end)}</Link></Table.Cell>
                        <Table.Cell>{s.role}</Table.Cell><Table.Cell>{s.siteName}</Table.Cell>
                        <Table.Cell><ShiftBadge status={s.status} /></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>
            )}
          </>
        )}
      </Load>
    </>
  );
}

/** Agency staff choose which configured roles a worker can be booked for. */
function EditWorkerRoles({ workerId, name, current, onSaved }: { workerId: string; name: string; current: string[]; onSaved: () => void }) {
  const send = useSend();
  const { roles } = useRoles();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [skills, setSkills] = useState(current);
  // Active roles, plus any the worker already has that were since deactivated (so they can be removed).
  const options = (roles ?? []).filter((r) => r.active || current.includes(r.name))
    .map((r) => ({ id: r.name, label: r.name, hint: `${r.active ? "" : "inactive · "}${r.requiredDocs.length ? `needs ${r.requiredDocs.length} doc${r.requiredDocs.length === 1 ? "" : "s"}` : "base docs"}` }));

  async function save() {
    try {
      await send(`/workers/${workerId}/roles`, "PATCH", { skills });
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setSkills(current); }}>
      <Dialog.Trigger><Button variant="soft">Edit roles</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Roles for {name}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">They can be booked for these roles once they hold each role's required documents. <Link href="/configuration?section=job-roles">Manage roles</Link></Dialog.Description>
        <ErrorCallout error={error} />
        <MultiSelect noun="role" value={skills} onChange={setSkills} options={options} />
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Cancel</Button></Dialog.Close>
          <Button onClick={save} disabled={!skills.length}>Save</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
