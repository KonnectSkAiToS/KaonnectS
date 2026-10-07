"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, Flex, Grid, Table, Tabs, Text } from "@radix-ui/themes";
import { ApiError, fmtDateTime, fmtTime, useApi, useRole, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, PageHeader, StatusBadge } from "@/components/ui";
import type { AttendanceEvent, ShiftView } from "@/lib/types";

type Ev = AttendanceEvent & { workerName: string; siteName: string; shiftStart: string; shiftEnd: string };
interface Data { events: Ev[]; onShift: { shift: ShiftView; checkIn: Ev | null }[] }

export default function AttendancePage() {
  const { role } = useRole();
  const send = useSend();
  const { data, error, reload } = useApi<Data>("/attendance");
  const [actionError, setActionError] = useState<ApiError>();
  const canApprove = role !== "coordinator";

  async function decide(id: string, status: "accepted" | "rejected") {
    try {
      setActionError(undefined);
      await send(`/attendance/${id}`, "PATCH", { status });
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <>
      <PageHeader title="Attendance" subtitle="Geofenced check-ins, manual check-in approvals and the live on-shift board." />
      <ErrorCallout error={actionError} />
      <Load data={data} error={error}>
        {({ events, onShift }) => {
          const pending = events.filter((e) => e.status === "pending");
          return (
            <Tabs.Root defaultValue="live">
              <Tabs.List>
                <Tabs.Trigger value="live">On shift now ({onShift.length})</Tabs.Trigger>
                <Tabs.Trigger value="manual">Manual check-ins {pending.length > 0 && <Badge ml="2" color="amber">{pending.length}</Badge>}</Tabs.Trigger>
                <Tabs.Trigger value="log">Check-in log</Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="live">
                {onShift.length === 0 ? <Empty>Nobody is on shift right now.</Empty> : (
                  <Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="3" mt="4">
                    {onShift.map(({ shift: s, checkIn }) => (
                      <Card key={s.id}>
                        <Flex justify="between" align="start">
                          <div>
                            <Link href={`/workers/${s.workerId}`}><Text weight="bold">{s.workerName}</Text></Link>
                            <Text as="div" size="2" color="gray">{s.role} · {s.siteName}</Text>
                            <Text as="div" size="2" color="gray">{fmtTime(s.start)}–{fmtTime(s.end)}</Text>
                          </div>
                          {checkIn && <StatusBadge status={checkIn.status} />}
                        </Flex>
                        <Text as="div" size="1" mt="2">
                          {checkIn ? <>In at {fmtTime(checkIn.at)} via {checkIn.method}{checkIn.method === "gps" && ` · ${checkIn.distanceM} m from site`}</> : "No check-in recorded"}
                        </Text>
                      </Card>
                    ))}
                  </Grid>
                )}
              </Tabs.Content>

              <Tabs.Content value="manual">
                {pending.length === 0 ? <Empty>No manual check-ins waiting.</Empty> : (
                  <Table.Root size="1" mt="3">
                    <Table.Header><Table.Row>
                      <Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Site</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Reason given</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
                    </Table.Row></Table.Header>
                    <Table.Body>
                      {pending.map((e) => (
                        <Table.Row key={e.id}>
                          <Table.Cell>{e.workerName}</Table.Cell>
                          <Table.Cell>{e.siteName}</Table.Cell>
                          <Table.Cell>{fmtDateTime(e.at)}</Table.Cell>
                          <Table.Cell>{e.reason}</Table.Cell>
                          <Table.Cell>
                            {canApprove ? (
                              <Flex gap="2">
                                <Button size="1" color="green" onClick={() => decide(e.id, "accepted")}>Approve</Button>
                                <Button size="1" color="red" variant="soft" onClick={() => decide(e.id, "rejected")}>Reject</Button>
                              </Flex>
                            ) : <Text size="1" color="gray">Client approves</Text>}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Tabs.Content>

              <Tabs.Content value="log">
                <Table.Root size="1" mt="3">
                  <Table.Header><Table.Row>
                    <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Site</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Event</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Method</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Distance</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  </Table.Row></Table.Header>
                  <Table.Body>
                    {events.slice(0, 100).map((e) => (
                      <Table.Row key={e.id}>
                        <Table.Cell>{fmtDateTime(e.at)}</Table.Cell>
                        <Table.Cell>{e.workerName}</Table.Cell>
                        <Table.Cell>{e.siteName}</Table.Cell>
                        <Table.Cell>Check-{e.kind}</Table.Cell>
                        <Table.Cell>{e.method}{e.offlineSynced && <Badge ml="1" color="gray">offline-synced</Badge>}</Table.Cell>
                        <Table.Cell>{e.method === "manual" ? "—" : `${e.distanceM} m`}</Table.Cell>
                        <Table.Cell><StatusBadge status={e.status} /></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Tabs.Content>
            </Tabs.Root>
          );
        }}
      </Load>
    </>
  );
}
