"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Box, Button, Callout, Card, Flex, Grid, Heading, Table, Text } from "@radix-ui/themes";
import { ApiError, fmtDate, fmtDateTime, fmtTime, useApi, useRole, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, PageHeader } from "@/components/ui";
import type { ShiftView, WorkerDocument } from "@/lib/types";

interface Dashboard {
  today: { total: number; open: number; filled: number; inProgress: number; noShow: number };
  next7: { day: string; total: number; filled: number }[];
  urgent: ShiftView[];
  complianceAlerts: (WorkerDocument & { workerName: string; daysLeft: number })[];
  pending: { timesheets: number; manualCheckins: number; documents: number };
}

function Stat({ label, value, color, href }: { label: string; value: number; color?: string; href?: string }) {
  const body = (
    <Card>
      <Text as="div" size="2" color="gray">{label}</Text>
      <Text as="div" size="7" weight="bold" style={{ color }}>{value}</Text>
    </Card>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { role } = useRole();
  const send = useSend();
  const { data, error, reload } = useApi<Dashboard>("/dashboard");
  const [fill, setFill] = useState<{ filled: number; total: number }>();
  const [fillError, setFillError] = useState<ApiError>();

  async function autoFill() {
    try {
      setFillError(undefined);
      setFill(await send<{ filled: number; total: number }>("/shifts/autofill", "POST", {}));
      reload();
    } catch (e) {
      setFillError(e as ApiError);
    }
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Today's shifts, things needing attention, and the week ahead.">
        {role !== "client_admin" && !!data?.urgent.length && <Button onClick={autoFill}>Auto-fill next 72h ({data.urgent.length})</Button>}
      </PageHeader>
      <ErrorCallout error={fillError} />
      {fill && (
        <Callout.Root color={fill.filled === fill.total ? "green" : "amber"} mb="4">
          <Callout.Text>Auto-fill assigned {fill.filled} of {fill.total} shifts to the best-ranked bookable workers.{fill.filled < fill.total && " The rest have nobody who passes the booking rules."}</Callout.Text>
        </Callout.Root>
      )}
      <Load data={data} error={error}>
        {(d) => (
          <Flex direction="column" gap="5">
            <Grid columns={{ initial: "2", md: "5" }} gap="3">
              <Stat label="Shifts today" value={d.today.total} />
              <Stat label="Unfilled today" value={d.today.open} color={d.today.open ? "var(--orange-11)" : undefined} href="/shifts?status=open" />
              <Stat label="Filled today" value={d.today.filled} />
              <Stat label="On shift now" value={d.today.inProgress} href="/attendance" />
              <Stat label="No-shows today" value={d.today.noShow} color={d.today.noShow ? "var(--red-11)" : undefined} />
            </Grid>

            <Grid columns={{ initial: "1", sm: "3" }} gap="3">
              <Stat label="Timesheets awaiting approval" value={d.pending.timesheets} href="/timesheets" />
              <Stat label="Manual check-ins to approve" value={d.pending.manualCheckins} href="/attendance" />
              <Stat label="Documents to verify" value={d.pending.documents} href="/compliance" />
            </Grid>

            <Grid columns={{ initial: "1", md: "2" }} gap="4">
              <Card>
                <Heading size="3" mb="3">Urgent: unfilled in the next 72 hours</Heading>
                {d.urgent.length ? (
                  <Table.Root size="1">
                    <Table.Body>
                      {d.urgent.slice(0, 8).map((s) => (
                        <Table.Row key={s.id}>
                          <Table.Cell><Link href={`/shifts/${s.id}`}>{fmtDate(s.start)} {fmtTime(s.start)}</Link></Table.Cell>
                          <Table.Cell>{s.role}</Table.Cell>
                          <Table.Cell>{s.siteName}</Table.Cell>
                          <Table.Cell>{s.urgent && <Badge color="red">urgent</Badge>} {s.applicants.length > 0 && <Badge color="amber">{s.applicants.length} applied</Badge>}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                ) : <Empty>All shifts in the next 72 hours are filled.</Empty>}
              </Card>

              <Card>
                <Heading size="3" mb="3">Fill rate: next 7 days</Heading>
                <Flex direction="column" gap="2">
                  {d.next7.map((x) => (
                    <Flex key={x.day} align="center" gap="3">
                      <Text size="2" style={{ width: 90 }}>{fmtDate(x.day)}</Text>
                      <Box flexGrow="1" className="bar"><span style={{ width: `${x.total ? (x.filled / x.total) * 100 : 0}%` }} /></Box>
                      <Text size="1" color="gray" style={{ width: 60, textAlign: "right" }}>{x.filled}/{x.total}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Card>
            </Grid>

            {d.complianceAlerts.length > 0 && (
              <Card>
                <Heading size="3" mb="3">Compliance alerts: expired or expiring within 30 days</Heading>
                <Table.Root size="1">
                  <Table.Header>
                    <Table.Row><Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Document</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Expires</Table.ColumnHeaderCell><Table.ColumnHeaderCell /></Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {d.complianceAlerts.map((a) => (
                      <Table.Row key={a.id}>
                        <Table.Cell><Link href={`/workers/${a.workerId}`}>{a.workerName}</Link></Table.Cell>
                        <Table.Cell>{a.type}</Table.Cell>
                        <Table.Cell>{fmtDateTime(a.expiresOn!).split(",")[0]}</Table.Cell>
                        <Table.Cell>
                          <Badge color={a.daysLeft < 0 ? "red" : a.daysLeft <= 7 ? "orange" : a.daysLeft <= 14 ? "amber" : "yellow"}>
                            {a.daysLeft < 0 ? `expired ${-a.daysLeft}d ago` : `${a.daysLeft}d left`}
                          </Badge>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>
            )}
          </Flex>
        )}
      </Load>
    </>
  );
}
