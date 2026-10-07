"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge, Card, Flex, Select, Table, Text } from "@radix-ui/themes";
import { fmtDate, fmtMoney, fmtTime, useApi, useRole } from "@/lib/client";
import { Empty, Load, PageHeader, ShiftBadge } from "@/components/ui";
import { Pager, SortHeader, useTable } from "@/components/table";
import type { ShiftStatus, ShiftView } from "@/lib/types";
import { NewShiftDialog } from "./NewShiftDialog";

const STATUSES: ShiftStatus[] = ["open", "applied", "assigned", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
const RANGES = { upcoming: "Upcoming", past: "Past 7 days", all: "All" } as const;

function Shifts() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [range, setRange] = useState<keyof typeof RANGES>("upcoming");
  // Fixed at first render: a fresh timestamp each render would change the URL and refetch forever.
  const [now] = useState(() => new Date().toISOString());
  const q = new URLSearchParams();
  if (status !== "all") q.set("status", status);
  if (range === "upcoming") q.set("from", now);
  if (range === "past") { q.set("to", now); q.set("from", new Date(Date.parse(now) - 7 * 864e5).toISOString()); }
  const { data, error, reload } = useApi<ShiftView[]>(`/shifts?${q}`);

  return (
    <>
      <PageHeader title="Shifts" subtitle="Post shifts, review applications and assign workers.">
        <NewShiftDialog onCreated={reload} />
      </PageHeader>
      <Flex gap="3" mb="4" wrap="wrap">
        <Select.Root value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
          <Select.Trigger />
          <Select.Content>{Object.entries(RANGES).map(([k, v]) => <Select.Item key={k} value={k}>{v}</Select.Item>)}</Select.Content>
        </Select.Root>
        <Select.Root value={status} onValueChange={setStatus}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">All statuses</Select.Item>
            {STATUSES.map((s) => <Select.Item key={s} value={s}>{s.replace("_", " ")}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      </Flex>
      <Load data={data} error={error}>
        {(shifts) => shifts.length === 0 ? <Empty>No shifts match these filters.</Empty> : (
          <ShiftsTable shifts={shifts} />
        )}
      </Load>
    </>
  );
}

export default function ShiftsPage() {
  return <Suspense><Shifts /></Suspense>;
}

function ShiftsTable({ shifts }: { shifts: ShiftView[] }) {
  const router = useRouter();
  const { role } = useRole();
  const t = useTable(shifts, {
    when: (s) => s.start, site: (s) => s.siteName, role: (s) => s.role,
    worker: (s) => s.workerName, pay: (s) => s.payRate, bill: (s) => s.billRate, status: (s) => s.status,
  });
  return (
    <Card style={{ overflowX: "auto" }}>
      <Table.Root size="1">
        <Table.Header>
          <Table.Row>
            <SortHeader label="When" k="when" t={t} />
            <SortHeader label="Site" k="site" t={t} />
            <SortHeader label="Role" k="role" t={t} />
            <SortHeader label="Worker" k="worker" t={t} />
            {role !== "client_admin" && <SortHeader label="Pay" k="pay" t={t} />}
            {role !== "coordinator" && <SortHeader label="Bill" k="bill" t={t} />}
            <SortHeader label="Status" k="status" t={t} />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {t.rows.map((s) => (
            <Table.Row key={s.id} className="rowlink" onClick={() => router.push(`/shifts/${s.id}`)}>
              <Table.Cell>{fmtDate(s.start)}<Text color="gray"> · {fmtTime(s.start)}–{fmtTime(s.end)}</Text></Table.Cell>
              <Table.Cell>{s.siteName}</Table.Cell>
              <Table.Cell>{s.role}</Table.Cell>
              <Table.Cell>{s.workerName ?? (s.applicants.length ? <Badge color="amber">{s.applicants.length} applied</Badge> : <Text color="gray">—</Text>)}</Table.Cell>
              {role !== "client_admin" && <Table.Cell>{fmtMoney(s.payRate)}</Table.Cell>}
              {role !== "coordinator" && <Table.Cell>{fmtMoney(s.billRate)}</Table.Cell>}
              <Table.Cell><Flex gap="1"><ShiftBadge status={s.status} />{s.urgent && <Badge color="red">urgent</Badge>}</Flex></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <Pager {...t.pager} />
    </Card>
  );
}
