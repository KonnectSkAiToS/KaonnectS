"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Callout, Card, DataList, Flex, Grid, Heading, Table, Text } from "@radix-ui/themes";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { fmtDate, fmtHours, fmtTime, useApi } from "@/lib/client";
import { ComplianceBadge, Empty, Load, PageHeader, ShiftBadge, StatusBadge } from "@/components/ui";
import { WTR_MAX_HOURS } from "@/lib/rules";
import type { ComplianceStatus, DocType, ShiftView, Worker, WorkerDocument } from "@/lib/types";

interface Detail { worker: Worker; compliance: ComplianceStatus; missing: DocType[]; weekHours: number; documents: WorkerDocument[]; shifts: ShiftView[] }
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WorkerPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApi<Detail>(`/workers/${id}`);
  return (
    <>
      <Link href="/workers" style={{ textDecoration: "none" }}><Text size="2" color="gray"><Flex align="center" gap="1" mb="3"><ArrowLeftIcon /> All workers</Flex></Text></Link>
      <Load data={data} error={error}>
        {({ worker: w, compliance, missing, weekHours, documents, shifts }) => (
          <>
            <PageHeader title={w.name} subtitle={w.skills.join(" · ")}><ComplianceBadge status={compliance} /></PageHeader>
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
              </Card>
            </Grid>

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
