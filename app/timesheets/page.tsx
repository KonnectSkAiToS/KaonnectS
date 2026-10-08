"use client";
import { useState } from "react";
import { Badge, Box, Button, Card, Dialog, Flex, Grid, Select, Table, Tabs, Text, TextArea, TextField } from "@radix-ui/themes";
import { DownloadIcon, PlusIcon } from "@radix-ui/react-icons";
import { SearchSelect } from "@/components/SearchSelect";
import { ApiError, downloadFile, ukDate, fmtDate, fmtHours, fmtMoney, useApi, useRole, useRoles, useSend, useSettings } from "@/lib/client";
import Link from "next/link";
import { Empty, ErrorCallout, Load, PageHeader, StatusBadge } from "@/components/ui";
import { Pager, SortHeader, useTable } from "@/components/table";
import type { Client, PayrollConnection, PayrollProvider, PayrollSync as PayrollSyncRecord, RateCard, Role, Timesheet } from "@/lib/types";

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
    try {
      await downloadFile("/timesheets/export", `payrun-${ukDate(new Date())}.csv`);
    } catch (e) {
      setActionError(e as ApiError);
    }
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
        const clients = [...new Map(rates.map((r) => [r.clientId, r.clientName])).entries()];
        const rows = rates.filter((r) => client === "all" || r.clientId === client);
        return (
          <Flex direction="column" gap="3" mt="3">
            <Flex gap="3" align="center" justify="between" wrap="wrap">
              <Flex gap="3" align="center" wrap="wrap">
                <Box style={{ width: 280 }}>
                  <SearchSelect noun="client" value={client} onChange={setClient}
                    options={[{ id: "all", label: "All clients", hint: `${rates.length} rates` },
                      ...clients.map(([id, name]) => ({ id, label: name, hint: `${rates.filter((r) => r.clientId === id).length} rates` }))]} />
                </Box>
                {role === "super_admin" && <Text size="1" color="gray">Changes apply to shifts posted from now on. Existing shifts keep their rate.</Text>}
              </Flex>
              {role === "super_admin" && <AddRateCard defaultClientId={client === "all" ? "" : client} onSaved={reload} />}
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

const DAY_TYPES = { weekday: "Weekday", weekend: "Weekend", night: "Night (starts 20:00 or later)" } as const;

/** Add a rate for a client / role / day type with no rate yet (e.g. a care client that now needs a Kitchen Porter). */
function AddRateCard({ defaultClientId, onSaved }: { defaultClientId: string; onSaved: () => void }) {
  const send = useSend();
  const { data: clients } = useApi<Client[]>("/clients");
  const { forSector } = useRoles();
  const { get } = useSettings();
  const minPay = get("pay.minPayRate", 12.21), marginPct = get("rates.defaultMarginPct", 32);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const blank = () => ({ clientId: defaultClientId, role: "", dayType: "weekday" as keyof typeof DAY_TYPES, payRate: "", billRate: "" });
  const [f, setF] = useState(blank);
  const pay = Number(f.payRate), bill = Number(f.billRate);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/ratecards", "POST", { clientId: f.clientId, role: f.role, dayType: f.dayType, payRate: pay, billRate: bill });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setF(blank()); }}>
      <Dialog.Trigger><Button><PlusIcon /> Add rate card</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Add rate card</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">One rate per client, role and day type. Shifts use it from now on.</Dialog.Description>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Client</Text>
              <SearchSelect noun="client" placeholder="Choose client" value={f.clientId} onChange={(clientId) => setF({ ...f, clientId })}
                options={clients?.map((c) => ({ id: c.id, label: c.name, hint: c.sector })) ?? []} />
            </label>
            <Flex gap="3">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" weight="medium" mb="1">Role</Text>
                <SearchSelect noun="role" placeholder="Choose role" value={f.role} onChange={(role) => setF({ ...f, role })}
                  options={forSector().map((r) => ({ id: r, label: r }))} />
                <Text size="1"><Link href="/configuration?section=job-roles">Manage roles</Link></Text>
              </label>
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" weight="medium" mb="1">Day type</Text>
                <Select.Root value={f.dayType} onValueChange={(d) => setF({ ...f, dayType: d as keyof typeof DAY_TYPES })}>
                  <Select.Trigger style={{ width: "100%" }} />
                  <Select.Content>{Object.entries(DAY_TYPES).map(([k, v]) => <Select.Item key={k} value={k}>{v}</Select.Item>)}</Select.Content>
                </Select.Root>
              </label>
            </Flex>
            <Flex gap="3">
              <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">Pay rate (£/h)</Text>
                <TextField.Root type="number" step="0.01" min={minPay} value={f.payRate}
                  onChange={(e) => setF({ ...f, payRate: e.target.value, billRate: f.billRate || !e.target.value ? f.billRate : (Number(e.target.value) * (1 + marginPct / 100)).toFixed(2) })} />
              </label>
              <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">Bill rate (£/h)</Text>
                <TextField.Root type="number" step="0.01" value={f.billRate} onChange={(e) => setF({ ...f, billRate: e.target.value })} />
              </label>
            </Flex>
            {pay > 0 && bill > 0 && (
              <Text size="2" color={bill < pay ? "red" : undefined}>Margin {fmtMoney(bill - pay)}/h ({Math.round(((bill - pay) / bill) * 100)}%)</Text>
            )}
            <Text size="1" color="gray">Minimum pay rate £{minPay.toFixed(2)}/h. Bill rate is pre-filled with the {marginPct}% default uplift (Configuration → Rates & pay).</Text>
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.clientId || !f.role || !(pay > 0) || !(bill > 0)}>Add rate</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function EditRate({ rate, onSaved }: { rate: Rate; onSaved: () => void }) {
  const send = useSend();
  const minPay = useSettings().get("pay.minPayRate", 12.21);
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
              <TextField.Root type="number" step="0.01" min={minPay} value={f.payRate} onChange={(e) => setF({ ...f, payRate: e.target.value })} />
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
          <Text as="p" size="1" color="gray">Minimum pay rate £{minPay.toFixed(2)}/h (Configuration → Rates & pay).</Text>
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
