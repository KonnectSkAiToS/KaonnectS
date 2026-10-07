"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Dialog, Flex, Grid, Select, Table, Text, TextField } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtMoney, useApi, useRole, useSend } from "@/lib/client";
import { Empty, ErrorCallout, InvoiceBadge, Load, PageHeader } from "@/components/ui";
import { Pager, SortHeader, useTable } from "@/components/table";
import type { Client, Invoice, InvoiceLine } from "@/lib/types";

type Row = Omit<Invoice, "lines"> & { lineCount: number; clientName: string; overdue: boolean };
interface List { invoices: Row[]; summary: { outstanding: number; overdue: number; paidLast30: number; unbilledLines: number } }


const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayOnly = (s: string) => fmtDate(`${s}T00:00`);

export default function InvoicesPage() {
  const router = useRouter();
  const { role } = useRole();
  const { data, error, reload } = useApi<List>("/invoices");
  const [status, setStatus] = useState("all");

  return (
    <>
      <PageHeader
        title={role === "client_admin" ? "Billing" : "Invoices"}
        subtitle={role === "client_admin" ? "Your invoices from the agency, built from approved timesheets." : "Bill clients from approved timesheets. Each timesheet can only be invoiced once."}>
        {role === "super_admin" && <GenerateInvoice onCreated={(id) => router.push(`/invoices/${id}`)} />}
      </PageHeader>
      <Load data={data} error={error}>
        {({ invoices, summary }) => {
          const rows = invoices.filter((i) => status === "all" || (status === "overdue" ? i.overdue : i.status === status));
          return (
            <Flex direction="column" gap="4">
              <Grid columns={{ initial: "2", md: role === "super_admin" ? "4" : "3" }} gap="3">
                <Card><Text as="div" size="2" color="gray">Outstanding</Text><Text as="div" size="6" weight="bold">{fmtMoney(summary.outstanding)}</Text></Card>
                <Card><Text as="div" size="2" color="gray">Overdue</Text><Text as="div" size="6" weight="bold" color={summary.overdue ? "red" : undefined}>{fmtMoney(summary.overdue)}</Text></Card>
                <Card><Text as="div" size="2" color="gray">Paid (30 days)</Text><Text as="div" size="6" weight="bold">{fmtMoney(summary.paidLast30)}</Text></Card>
                {role === "super_admin" && <Card><Text as="div" size="2" color="gray">Approved hours not yet billed</Text><Text as="div" size="6" weight="bold">{summary.unbilledLines} lines</Text></Card>}
              </Grid>
              <Flex gap="3">
                <Select.Root value={status} onValueChange={setStatus}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="all">All invoices</Select.Item>
                    {role === "super_admin" && <Select.Item value="draft">Draft</Select.Item>}
                    <Select.Item value="issued">Issued</Select.Item>
                    <Select.Item value="overdue">Overdue</Select.Item>
                    <Select.Item value="paid">Paid</Select.Item>
                    <Select.Item value="void">Void</Select.Item>
                  </Select.Content>
                </Select.Root>
                <Button variant="ghost" onClick={reload}>Refresh</Button>
              </Flex>
              {rows.length === 0 ? <Empty>No invoices.</Empty> : <InvoiceTable rows={rows} />}
            </Flex>
          );
        }}
      </Load>
    </>
  );
}

function InvoiceTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const tbl = useTable(rows, {
    number: (i) => i.number, client: (i) => i.clientName, period: (i) => i.periodFrom,
    lines: (i) => i.lineCount, total: (i) => i.total, due: (i) => i.dueDate, status: (i) => (i.overdue ? "overdue" : i.status),
  });
  return (
    <Card style={{ overflowX: "auto" }}>
      <Table.Root size="1">
        <Table.Header><Table.Row>
          <SortHeader label="Invoice" k="number" t={tbl} /><SortHeader label="Client" k="client" t={tbl} />
          <SortHeader label="Period" k="period" t={tbl} /><SortHeader label="Lines" k="lines" t={tbl} />
          <SortHeader label="Total (inc. VAT)" k="total" t={tbl} /><SortHeader label="Due" k="due" t={tbl} />
          <SortHeader label="Status" k="status" t={tbl} />
        </Table.Row></Table.Header>
        <Table.Body>
          {tbl.rows.map((i) => (
            <Table.Row key={i.id} className="rowlink" onClick={() => router.push(`/invoices/${i.id}`)}>
              <Table.Cell><Text weight="medium">{i.number}</Text></Table.Cell>
              <Table.Cell>{i.clientName}</Table.Cell>
              <Table.Cell>{dayOnly(i.periodFrom)} – {dayOnly(i.periodTo)}</Table.Cell>
              <Table.Cell>{i.lineCount}</Table.Cell>
              <Table.Cell>{fmtMoney(i.total)}</Table.Cell>
              <Table.Cell>{i.dueDate ? dayOnly(i.dueDate) : "—"}</Table.Cell>
              <Table.Cell><InvoiceBadge status={i.status} overdue={i.overdue} /></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <Pager {...tbl.pager} />
    </Card>
  );
}

function GenerateInvoice({ onCreated }: { onCreated: (id: string) => void }) {
  const send = useSend();
  const { data: clients } = useApi<Client[]>("/clients");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const now = new Date();
  const [f, setF] = useState({ clientId: "", from: localIso(new Date(now.getTime() - 14 * 864e5)), to: localIso(now) });
  const [preview, setPreview] = useState<{ lines: InvoiceLine[]; subtotal: number; vat: number; total: number }>();
  const set = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); setPreview(undefined); };

  async function run(create: boolean) {
    try {
      setError(undefined);
      if (!create) return setPreview(await send("/invoices", "POST", { ...f, preview: true }));
      const inv = await send<Invoice>("/invoices", "POST", f);
      setOpen(false);
      onCreated(inv.id);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setPreview(undefined); setError(undefined); }}>
      <Dialog.Trigger><Button><PlusIcon /> Generate invoice</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Generate invoice</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">Bills approved timesheets in the period that haven't been invoiced yet, at the client's bill rate plus 20% VAT. It's saved as a draft for you to check before issuing.</Dialog.Description>
        <ErrorCallout error={error} />
        <Flex direction="column" gap="3">
          <Select.Root value={f.clientId} onValueChange={(clientId) => set({ clientId })}>
            <Select.Trigger placeholder="Choose client" />
            <Select.Content>{clients?.map((c) => <Select.Item key={c.id} value={c.id}>{c.name}</Select.Item>)}</Select.Content>
          </Select.Root>
          <Flex gap="3">
            <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">From</Text><TextField.Root type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
            <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">To</Text><TextField.Root type="date" value={f.to} min={f.from} onChange={(e) => set({ to: e.target.value })} /></label>
          </Flex>
          {preview && (
            <Card>
              {preview.lines.length === 0 ? <Text size="2" color="gray">Nothing to bill in this period.</Text> : (
                <Flex direction="column" gap="1">
                  <Text size="2">{preview.lines.length} timesheet lines · {preview.lines.reduce((a, l) => a + l.hours, 0).toFixed(1)} hours</Text>
                  <Text size="2">Subtotal {fmtMoney(preview.subtotal)} · VAT {fmtMoney(preview.vat)}</Text>
                  <Text size="3" weight="bold">Total {fmtMoney(preview.total)}</Text>
                </Flex>
              )}
            </Card>
          )}
        </Flex>
        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Cancel</Button></Dialog.Close>
          {preview?.lines.length
            ? <Button onClick={() => run(true)}>Create draft</Button>
            : <Button onClick={() => run(false)} disabled={!f.clientId}>Preview</Button>}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
