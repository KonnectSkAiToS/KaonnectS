"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Callout, Card, DataList, Flex, Grid, Heading, Table, Text } from "@radix-ui/themes";
import { ArrowLeftIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtDateTime, fmtHours, fmtMoney, fmtTime, useApi, useRole, useSend } from "@/lib/client";
import { ErrorCallout, Load, PageHeader, ShiftBadge, StatusBadge } from "@/components/ui";
import type { AttendanceEvent, Candidate, ShiftView, Site, Timesheet } from "@/lib/types";

interface Detail { shift: ShiftView; site: Site; candidates: Candidate[]; attendance: AttendanceEvent[]; timesheet: Timesheet | null }

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useRole();
  const send = useSend();
  const { data, error, reload } = useApi<Detail>(`/shifts/${id}`);
  const [actionError, setActionError] = useState<ApiError>();

  async function act(path: string, method: string, body: unknown) {
    try {
      setActionError(undefined);
      await send(path, method, body);
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <>
      <Link href="/shifts" style={{ textDecoration: "none" }}><Text size="2" color="gray"><Flex align="center" gap="1" mb="3"><ArrowLeftIcon /> All shifts</Flex></Text></Link>
      <Load data={data} error={error}>
        {({ shift: s, site, candidates, attendance, timesheet }) => {
          const canAssign = role !== "client_admin" && ["open", "applied"].includes(s.status);
          return (
            <>
              <PageHeader title={`${s.role} · ${s.siteName}`} subtitle={`${fmtDate(s.start)}, ${fmtTime(s.start)}–${fmtTime(s.end)}`}>
                {s.status === "assigned" && role !== "client_admin" && <Button variant="soft" onClick={() => act(`/shifts/${id}`, "PATCH", { action: "confirm" })}>Mark confirmed by worker</Button>}
                {["assigned", "confirmed"].includes(s.status) && role !== "client_admin" && <Button variant="soft" color="gray" onClick={() => act(`/shifts/${id}`, "PATCH", { action: "unassign" })}>Unassign</Button>}
                {["confirmed", "in_progress"].includes(s.status) && role !== "client_admin" && <Button variant="soft" color="red" onClick={() => act(`/shifts/${id}`, "PATCH", { action: "no_show" })}>Mark no-show</Button>}
                {["open", "applied", "assigned", "confirmed"].includes(s.status) && <Button color="red" variant="outline" onClick={() => confirm("Cancel this shift?") && act(`/shifts/${id}`, "PATCH", { action: "cancel" })}>Cancel shift</Button>}
              </PageHeader>
              <ErrorCallout error={actionError} />

              <Grid columns={{ initial: "1", md: "3" }} gap="4" mb="5">
                <Card>
                  <DataList.Root size="2">
                    <DataList.Item><DataList.Label>Status</DataList.Label><DataList.Value><Flex gap="1"><ShiftBadge status={s.status} />{s.urgent && <Badge color="red">urgent</Badge>}</Flex></DataList.Value></DataList.Item>
                    <DataList.Item><DataList.Label>Worker</DataList.Label><DataList.Value>{s.workerId ? <Link href={`/workers/${s.workerId}`}>{s.workerName}</Link> : "Not assigned"}</DataList.Value></DataList.Item>
                    {s.payRate !== undefined && <DataList.Item><DataList.Label>Pay rate</DataList.Label><DataList.Value>{fmtMoney(s.payRate)}/h</DataList.Value></DataList.Item>}
                    {s.billRate !== undefined && <DataList.Item><DataList.Label>Bill rate</DataList.Label><DataList.Value>{fmtMoney(s.billRate)}/h</DataList.Value></DataList.Item>}
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
                      Checked {a.kind} {fmtDateTime(a.at)} · {a.method} {a.method !== "manual" && `· ${a.distanceM} m`} <StatusBadge status={a.status} />
                    </Text>
                  )) : <Text size="2" color="gray">No check-ins yet.</Text>}
                  {timesheet && <Text as="p" size="2" mt="2">Timesheet: {fmtHours(timesheet.hours)} <StatusBadge status={timesheet.status} /></Text>}
                </Card>
              </Grid>

              {candidates.length > 0 && (
                <Card>
                  <Heading size="3" mb="1">Candidates</Heading>
                  <Text as="p" size="2" color="gray" mb="3">Ranked by reliability, availability on this day and whether they applied. Blocked workers show why the booking rules stop them.</Text>
                  {role === "client_admin" && (
                    <Callout.Root size="1" mb="3"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Client Admins can see candidates, but the agency makes the assignment.</Callout.Text></Callout.Root>
                  )}
                  <Table.Root size="1">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Bookable?</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {candidates.map(({ worker: w, reasons, score, applied }) => (
                        <Table.Row key={w.id}>
                          <Table.Cell><Link href={`/workers/${w.id}`}>{w.name}</Link> {applied && <Badge color="amber">applied</Badge>}</Table.Cell>
                          <Table.Cell>{score}</Table.Cell>
                          <Table.Cell>
                            {reasons.length ? (
                              <Flex direction="column" gap="1">{reasons.map((r) => <Text key={r} size="1" color="red">{r}</Text>)}</Flex>
                            ) : <Badge color="green">bookable</Badge>}
                          </Table.Cell>
                          <Table.Cell>
                            {canAssign && <Button size="1" disabled={reasons.length > 0} onClick={() => act(`/shifts/${id}/assign`, "POST", { workerId: w.id })}>Assign</Button>}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Card>
              )}
            </>
          );
        }}
      </Load>
    </>
  );
}
