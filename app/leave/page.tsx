"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Callout, Card, Dialog, Flex, Select, Table, Tabs, Text, TextField } from "@radix-ui/themes";
import { InfoCircledIcon, PlusIcon } from "@radix-ui/react-icons";
import { SearchSelect } from "@/components/SearchSelect";
import { ApiError, fmtDate, useApi, useRole, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, PageHeader, StatusBadge } from "@/components/ui";
import type { ContractType, LeaveBalance, LeaveRequest, LeaveType, Worker } from "@/lib/types";

type Row = LeaveRequest & { workerName: string; contractType: ContractType; balance: LeaveBalance; conflicts: number };

const TYPE_COLOR = { holiday: "green", unavailable: "gray", sick: "orange" } as const;
const days = (l: { from: string; to: string }) => Math.round((Date.parse(l.to) - Date.parse(l.from)) / 864e5) + 1;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function LeavePage() {
  const { role } = useRole();
  const send = useSend();
  const { data, error, reload } = useApi<Row[]>("/leave");
  const [actionError, setActionError] = useState<ApiError>();
  const [notice, setNotice] = useState<string>();
  const canDecide = role !== "client_admin";

  async function decide(l: Row, status: "approved" | "rejected") {
    try {
      setActionError(undefined);
      const res = await send<{ unassignedShifts: string[] }>(`/leave/${l.id}`, "PATCH", { status });
      setNotice(
        status === "approved" && res.unassignedShifts.length
          ? `Approved. ${res.unassignedShifts.length} booked shift(s) for ${l.workerName} were released and marked urgent.`
          : `Leave ${status}.`,
      );
      reload();
    } catch (e) {
      setNotice(undefined);
      setActionError(e as ApiError);
    }
  }

  return (
    <>
      <PageHeader title="Leave" subtitle="Holiday, unavailability and sickness. Approved leave stops the worker being booked for those days.">
        {canDecide && <RecordLeave onSaved={reload} />}
      </PageHeader>
      <ErrorCallout error={actionError} />
      {notice && (
        <Callout.Root color="green" mb="4"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>{notice}</Callout.Text></Callout.Root>
      )}
      <Load data={data} error={error}>
        {(rows) => {
          const pending = rows.filter((r) => r.status === "pending");
          return (
            <Tabs.Root defaultValue="pending">
              <Tabs.List>
                <Tabs.Trigger value="pending">Pending <Badge ml="2" color={pending.length ? "amber" : "gray"}>{pending.length}</Badge></Tabs.Trigger>
                <Tabs.Trigger value="calendar">Calendar</Tabs.Trigger>
                <Tabs.Trigger value="all">All requests</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="pending"><LeaveTable rows={pending} canDecide={canDecide} onDecide={decide} /></Tabs.Content>
              <Tabs.Content value="calendar"><LeaveCalendar rows={rows.filter((r) => r.status !== "rejected")} /></Tabs.Content>
              <Tabs.Content value="all"><LeaveTable rows={rows} canDecide={canDecide} onDecide={decide} /></Tabs.Content>
            </Tabs.Root>
          );
        }}
      </Load>
    </>
  );
}

function LeaveTable({ rows, canDecide, onDecide }: { rows: Row[]; canDecide: boolean; onDecide: (l: Row, s: "approved" | "rejected") => void }) {
  if (!rows.length) return <Empty>No leave requests here.</Empty>;
  return (
    <Card mt="3" style={{ overflowX: "auto" }}>
      <Table.Root size="1">
        <Table.Header><Table.Row>
          <Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Dates</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Holiday balance</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Clashes</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
        </Table.Row></Table.Header>
        <Table.Body>
          {rows.map((l) => (
            <Table.Row key={l.id}>
              <Table.Cell><Link href={`/workers/${l.workerId}`}>{l.workerName}</Link><Text as="div" size="1" color="gray">{l.contractType}</Text></Table.Cell>
              <Table.Cell><Badge color={TYPE_COLOR[l.type]}>{l.type}</Badge></Table.Cell>
              <Table.Cell>
                {fmtDate(`${l.from}T00:00`)}{l.to !== l.from && <> – {fmtDate(`${l.to}T00:00`)}</>}
                <Text as="div" size="1" color="gray">{days(l)} day{days(l) > 1 && "s"}{l.note && ` · ${l.note}`}</Text>
              </Table.Cell>
              <Table.Cell>
                {l.balance.eligible
                  ? <><Text>{l.balance.remainingHours}h left</Text><Text as="div" size="1" color="gray">{l.balance.accruedHours}h accrued · {l.balance.usedHours}h used</Text></>
                  : <Text size="1" color="gray">Not eligible (umbrella)</Text>}
              </Table.Cell>
              <Table.Cell>{l.conflicts > 0 ? <Badge color="red">{l.conflicts} booked shift{l.conflicts > 1 && "s"}</Badge> : <Text color="gray">—</Text>}</Table.Cell>
              <Table.Cell><StatusBadge status={l.status} />{l.decidedBy && <Text as="div" size="1" color="gray">by {l.decidedBy}</Text>}</Table.Cell>
              <Table.Cell>
                {l.status === "pending" && canDecide && (
                  <Flex gap="2">
                    <Button size="1" color="green" onClick={() => onDecide(l, "approved")}>Approve</Button>
                    <Button size="1" color="red" variant="soft" onClick={() => onDecide(l, "rejected")}>Reject</Button>
                  </Flex>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Card>
  );
}

/** Next 28 days, one row per worker with leave in that window. */
function LeaveCalendar({ rows }: { rows: Row[] }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 28 }, (_, i) => iso(new Date(start.getTime() + i * 864e5)));
  const inWindow = rows.filter((r) => r.to >= dates[0] && r.from <= dates[27]);
  const workers = [...new Map(inWindow.map((r) => [r.workerId, r.workerName])).entries()];
  if (!workers.length) return <Empty>No leave in the next 4 weeks.</Empty>;

  return (
    <Card mt="3" style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `150px repeat(28, minmax(26px, 1fr))`, gap: 2, minWidth: 950, fontSize: 11 }}>
        <div />
        {dates.map((d) => {
          const dt = new Date(`${d}T00:00`);
          return <div key={d} style={{ textAlign: "center", color: "var(--gray-11)", fontWeight: [0, 6].includes(dt.getDay()) ? 600 : 400 }}>{dt.getDate()}<br />{dt.toLocaleDateString("en-GB", { weekday: "narrow" })}</div>;
        })}
        {workers.map(([id, name]) => (
          <div key={id} style={{ display: "contents" }}>
            <Text size="1" truncate style={{ alignSelf: "center" }}>{name}</Text>
            {dates.map((d) => {
              const l = inWindow.find((r) => r.workerId === id && r.from <= d && r.to >= d);
              const color = l ? TYPE_COLOR[l.type] : null;
              return (
                <div key={d} title={l ? `${l.type} (${l.status})` : undefined} style={{
                  height: 22, borderRadius: 3,
                  background: color ? `var(--${color}-${l!.status === "approved" ? 9 : 5})` : "var(--gray-a3)",
                }} />
              );
            })}
          </div>
        ))}
      </div>
      <Flex gap="3" mt="3" wrap="wrap">
        {Object.entries(TYPE_COLOR).map(([t, c]) => <Badge key={t} color={c}>{t}</Badge>)}
        <Text size="1" color="gray">Solid = approved, light = pending</Text>
      </Flex>
    </Card>
  );
}

function RecordLeave({ onSaved }: { onSaved: () => void }) {
  const send = useSend();
  const { data: workers } = useApi<Worker[]>("dummy:/workers");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const today = iso(new Date());
  const [f, setF] = useState({ workerId: "", type: "holiday" as LeaveType, from: today, to: today, note: "" });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const umbrella = workers?.find((w) => w.id === f.workerId)?.contractType === "Umbrella";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/leave", "POST", f);
      setOpen(false);
      setError(undefined);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> Record leave</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Record leave</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">For requests made by phone. Workers normally request leave in the app. It is saved as pending.</Dialog.Description>
        <ErrorCallout error={error} />
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Worker</Text>
              <SearchSelect noun="worker" placeholder="Choose worker" value={f.workerId} onChange={(workerId) => set({ workerId })}
                options={workers?.map((w) => ({ id: w.id, label: w.name, hint: w.contractType })) ?? []} />
            </label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Type</Text>
              <Select.Root value={f.type} onValueChange={(type) => set({ type: type as LeaveType })}>
                <Select.Trigger style={{ width: "100%" }} />
                <Select.Content>
                  <Select.Item value="holiday" disabled={umbrella}>Holiday{umbrella && " (not for umbrella workers)"}</Select.Item>
                  <Select.Item value="unavailable">Unavailable</Select.Item>
                  <Select.Item value="sick">Sick</Select.Item>
                </Select.Content>
              </Select.Root>
            </label>
            <Flex gap="3">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" weight="medium" mb="1">From</Text>
                <TextField.Root type="date" value={f.from} onChange={(e) => set({ from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} required />
              </label>
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" weight="medium" mb="1">To</Text>
                <TextField.Root type="date" value={f.to} min={f.from} onChange={(e) => set({ to: e.target.value })} required />
              </label>
            </Flex>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Note (optional)</Text>
              <TextField.Root value={f.note} onChange={(e) => set({ note: e.target.value })} />
            </label>
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.workerId}>Save</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
