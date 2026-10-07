"use client";
import { useState } from "react";
import { Badge, Button, Card, Dialog, Flex, Grid, Select, Table, Tabs, Text, TextArea, TextField } from "@radix-ui/themes";
import { MIN_PAY_RATE } from "@/lib/rules";
import { DownloadIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtHours, fmtMoney, useApi, useRole, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, PageHeader, StatusBadge } from "@/components/ui";
import { Pager, SortHeader, useTable } from "@/components/table";
import type { PayrollConnection, PayrollProvider, PayrollSync as PayrollSyncRecord, RateCard, Role, Timesheet } from "@/lib/types";

type TS = Timesheet & { workerName: string; siteName: string };

export default function TimesheetsPage() {
  const { role } = useRole();
  const send = useSend();
  const { data, error, reload } = useApi<TS[]>("/timesheets");
  const [actionError, setActionError] = useState<ApiError>();

  async function update(id: string, body: { status: string; note?: string }) {
    try {
      setActionError(undefined);
      await send(`/timesheets/${id}`, "PATCH", body);
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  async function exportCsv() {
    const res = await fetch("/api/timesheets/export", { headers: { "x-role": role } });
    if (!res.ok) return setActionError(new ApiError("Export failed", res.status));
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: `payrun-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="Timesheets & Pay" subtitle="Generated automatically from check-out. Approve, dispute, and export the pay run.">
        {role === "super_admin" && <Button onClick={exportCsv}><DownloadIcon /> Export pay run (CSV)</Button>}
      </PageHeader>
      <ErrorCallout error={actionError} />
      <Load data={data} error={error}>
        {(all) => (
          <Tabs.Root defaultValue="pending">
            <Tabs.List>
              {(["pending", "disputed", "approved"] as const).map((s) => (
                <Tabs.Trigger key={s} value={s}>{s[0].toUpperCase() + s.slice(1)} <Badge ml="2" color="gray">{all.filter((t) => t.status === s).length}</Badge></Tabs.Trigger>
              ))}
              <Tabs.Trigger value="rates">Rate cards</Tabs.Trigger>
              {role === "super_admin" && <Tabs.Trigger value="payroll">Payroll sync</Tabs.Trigger>}
            </Tabs.List>
            {role === "super_admin" && <Tabs.Content value="payroll"><PayrollSync onSynced={reload} /></Tabs.Content>}
            {(["pending", "disputed", "approved"] as const).map((s) => (
              <Tabs.Content key={s} value={s}>
                <TimesheetTable rows={all.filter((t) => t.status === s)} role={role} onUpdate={update} />
              </Tabs.Content>
            ))}
            <Tabs.Content value="rates"><RateCards /></Tabs.Content>
          </Tabs.Root>
        )}
      </Load>
    </>
  );
}

function TimesheetTable({ rows, role, onUpdate }: { rows: TS[]; role: Role; onUpdate: (id: string, b: { status: string; note?: string }) => void }) {
  const tbl = useTable(rows, {
    date: (r) => r.date, worker: (r) => r.workerName, site: (r) => r.siteName, hours: (r) => r.hours,
    pay: (r) => r.hours * (r.payRate ?? 0), bill: (r) => r.hours * (r.billRate ?? 0),
  }, { key: "date", dir: "desc" });
  if (!rows.length) return <Empty>Nothing here.</Empty>;
  return (
    <Card mt="3" style={{ overflowX: "auto" }}>
      <Table.Root size="1">
        <Table.Header><Table.Row>
          <SortHeader label="Date" k="date" t={tbl} /><SortHeader label="Worker" k="worker" t={tbl} /><SortHeader label="Site" k="site" t={tbl} />
          <SortHeader label="Hours" k="hours" t={tbl} />
          {role !== "client_admin" && <SortHeader label="Pay" k="pay" t={tbl} />}
          {role !== "coordinator" && <SortHeader label="Bill" k="bill" t={tbl} />}
          <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
        </Table.Row></Table.Header>
        <Table.Body>
          {tbl.rows.map((t) => {
            const canApprove = t.status !== "approved" && (role !== "coordinator" || t.status === "disputed");
            return (
              <Table.Row key={t.id}>
                <Table.Cell>{fmtDate(t.date)}</Table.Cell>
                <Table.Cell>{t.workerName}</Table.Cell>
                <Table.Cell>{t.siteName}</Table.Cell>
                <Table.Cell>{fmtHours(t.hours)}{t.breakMins > 0 && <Text color="gray" size="1"> ({t.breakMins}m break)</Text>}</Table.Cell>
                {role !== "client_admin" && <Table.Cell>{fmtMoney(t.hours * t.payRate!)}</Table.Cell>}
                {role !== "coordinator" && <Table.Cell>{fmtMoney(t.hours * t.billRate!)}</Table.Cell>}
                <Table.Cell><StatusBadge status={t.status} />{t.syncedTo && <Badge ml="1" color="gray">sent to {t.syncedTo}</Badge>}{t.note && <Text as="div" size="1" color="gray">{t.note}</Text>}</Table.Cell>
                <Table.Cell>
                  <Flex gap="2">
                    {canApprove && <Button size="1" color="green" onClick={() => onUpdate(t.id, { status: "approved" })}>{t.status === "disputed" ? "Resolve & approve" : "Approve"}</Button>}
                    {t.status === "pending" && role !== "coordinator" && <DisputeButton onSubmit={(note) => onUpdate(t.id, { status: "disputed", note })} />}
                  </Flex>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
      <Pager {...tbl.pager} />
    </Card>
  );
}

interface Payroll {
  connections: PayrollConnection[];
  syncs: PayrollSyncRecord[];
  ready: { lines: number; grossPay: number };
}

function PayrollSync({ onSynced }: { onSynced: () => void }) {
  const send = useSend();
  const { data, error, reload } = useApi<Payroll>("/payroll");
  const [actionError, setActionError] = useState<ApiError>();

  async function act(action: string, provider: PayrollProvider) {
    try {
      setActionError(undefined);
      await send("/payroll", "POST", { action, provider });
      reload();
      if (action === "sync") onSynced();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <Load data={data} error={error}>
      {({ connections, syncs, ready }) => (
        <Flex direction="column" gap="4" mt="3">
          <ErrorCallout error={actionError} />
          <Text size="2" color="gray">
            {ready.lines} approved timesheet line{ready.lines !== 1 && "s"} ({fmtMoney(ready.grossPay)} gross) waiting to be sent to payroll.
          </Text>
          <Grid columns={{ initial: "1", sm: "3" }} gap="3">
            {connections.map((c) => (
              <Card key={c.provider}>
                <Flex justify="between" align="center" mb="2">
                  <Text weight="bold">{c.provider}</Text>
                  <Badge color={c.connected ? "green" : "gray"}>{c.connected ? "connected" : "not connected"}</Badge>
                </Flex>
                {c.connected && <Text as="p" size="1" color="gray" mb="3">{c.orgName} · since {fmtDate(c.connectedAt!)}</Text>}
                <Flex gap="2">
                  {c.connected ? (
                    <>
                      <Button size="1" disabled={!ready.lines} onClick={() => act("sync", c.provider)}>Send pay run</Button>
                      <Button size="1" variant="soft" color="gray" onClick={() => act("disconnect", c.provider)}>Disconnect</Button>
                    </>
                  ) : <Button size="1" variant="soft" onClick={() => act("connect", c.provider)}>Connect</Button>}
                </Flex>
              </Card>
            ))}
          </Grid>
          <Card style={{ overflowX: "auto" }}>
            <Text as="div" weight="bold" mb="2">Sync history</Text>
            <Table.Root size="1">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>When</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Provider</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Lines</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Gross pay</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Result</Table.ColumnHeaderCell><Table.ColumnHeaderCell>By</Table.ColumnHeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {syncs.map((s) => (
                  <Table.Row key={s.id}>
                    <Table.Cell>{fmtDate(s.at)}</Table.Cell><Table.Cell>{s.provider}</Table.Cell>
                    <Table.Cell>{s.lines}</Table.Cell><Table.Cell>{fmtMoney(s.grossPay)}</Table.Cell>
                    <Table.Cell><Badge color={s.status === "success" ? "green" : "red"}>{s.status}</Badge> <Text size="1" color="gray">{s.message}</Text></Table.Cell>
                    <Table.Cell>{s.by}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        </Flex>
      )}
    </Load>
  );
}

type Rate = RateCard & { clientName: string };

function RateCards() {
  const { role } = useRole();
  const { data, error, reload } = useApi<Rate[]>("/ratecards");
  const [client, setClient] = useState("all");
  return (
    <Load data={data} error={error}>
      {(rates) => {
        const clients = [...new Set(rates.map((r) => r.clientName))];
        const rows = rates.filter((r) => client === "all" || r.clientName === client);
        return (
          <Flex direction="column" gap="3" mt="3">
            <Flex gap="3" align="center" wrap="wrap">
              <Select.Root value={client} onValueChange={setClient}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="all">All clients</Select.Item>
                  {clients.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}
                </Select.Content>
              </Select.Root>
              {role === "super_admin" && <Text size="1" color="gray">Changes apply to shifts posted from now on. Existing shifts keep their rate.</Text>}
            </Flex>
            <Card style={{ overflowX: "auto" }}>
              <Table.Root size="1">
                <Table.Header><Table.Row>
                  <Table.ColumnHeaderCell>Client</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Day type</Table.ColumnHeaderCell>
                  {role !== "client_admin" && <Table.ColumnHeaderCell>Pay rate</Table.ColumnHeaderCell>}
                  {role !== "coordinator" && <Table.ColumnHeaderCell>Bill rate</Table.ColumnHeaderCell>}
                  {role === "super_admin" && <><Table.ColumnHeaderCell>Margin</Table.ColumnHeaderCell><Table.ColumnHeaderCell /></>}
                </Table.Row></Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell>{r.clientName}</Table.Cell><Table.Cell>{r.role}</Table.Cell><Table.Cell>{r.dayType}</Table.Cell>
                      {role !== "client_admin" && <Table.Cell>{fmtMoney(r.payRate)}</Table.Cell>}
                      {role !== "coordinator" && <Table.Cell>{fmtMoney(r.billRate)}</Table.Cell>}
                      {role === "super_admin" && <>
                        <Table.Cell>{fmtMoney(r.billRate! - r.payRate!)} <Text size="1" color="gray">({Math.round(((r.billRate! - r.payRate!) / r.billRate!) * 100)}%)</Text></Table.Cell>
                        <Table.Cell><EditRate rate={r} onSaved={reload} /></Table.Cell>
                      </>}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Card>
          </Flex>
        );
      }}
    </Load>
  );
}

function EditRate({ rate, onSaved }: { rate: Rate; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [f, setF] = useState({ payRate: String(rate.payRate), billRate: String(rate.billRate) });
  const pay = Number(f.payRate), bill = Number(f.billRate);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send(`/ratecards/${rate.id}`, "PATCH", { payRate: pay, billRate: bill });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setF({ payRate: String(rate.payRate), billRate: String(rate.billRate) }); }}>
      <Dialog.Trigger><Button size="1" variant="soft">Edit</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="380px">
        <Dialog.Title>{rate.role} · {rate.dayType}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{rate.clientName}</Dialog.Description>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex gap="3">
            <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">Pay rate (£/h)</Text>
              <TextField.Root type="number" step="0.01" min={MIN_PAY_RATE} value={f.payRate} onChange={(e) => setF({ ...f, payRate: e.target.value })} />
            </label>
            <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">Bill rate (£/h)</Text>
              <TextField.Root type="number" step="0.01" value={f.billRate} onChange={(e) => setF({ ...f, billRate: e.target.value })} />
            </label>
          </Flex>
          {pay > 0 && bill > 0 && (
            <Text as="p" size="2" mt="3" color={bill < pay ? "red" : undefined}>
              Margin {fmtMoney(bill - pay)}/h ({bill ? Math.round(((bill - pay) / bill) * 100) : 0}%)
            </Text>
          )}
          <Text as="p" size="1" color="gray">Minimum pay rate £{MIN_PAY_RATE.toFixed(2)}/h (National Living Wage).</Text>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit">Save</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function DisputeButton({ onSubmit }: { onSubmit: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Dialog.Root>
      <Dialog.Trigger><Button size="1" color="red" variant="soft">Dispute</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>Dispute timesheet</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">The agency coordinator will review your note.</Dialog.Description>
        <TextArea placeholder="e.g. Worker left 30 minutes early" value={note} onChange={(e) => setNote(e.target.value)} />
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Cancel</Button></Dialog.Close>
          <Dialog.Close><Button color="red" disabled={!note.trim()} onClick={() => onSubmit(note)}>Submit dispute</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
