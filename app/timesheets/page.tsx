"use client";
import { useState } from "react";
import { Badge, Button, Card, Dialog, Flex, Table, Tabs, Text, TextArea } from "@radix-ui/themes";
import { DownloadIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtHours, fmtMoney, useApi, useRole, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, PageHeader, StatusBadge } from "@/components/ui";
import type { RateCard, Role, Timesheet } from "@/lib/types";

type TS = Timesheet & { workerName: string; siteName: string };

export default function TimesheetsPage() {
  const { role } = useRole();
  const send = useSend();
  const { data, error, reload } = useApi<TS[]>("/timesheets");
  const { data: rates } = useApi<(RateCard & { clientName: string })[]>("/ratecards");
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
            </Tabs.List>
            {(["pending", "disputed", "approved"] as const).map((s) => (
              <Tabs.Content key={s} value={s}>
                <TimesheetTable rows={all.filter((t) => t.status === s)} role={role} onUpdate={update} />
              </Tabs.Content>
            ))}
            <Tabs.Content value="rates">
              <Card mt="3" style={{ overflowX: "auto" }}>
                <Table.Root size="1">
                  <Table.Header><Table.Row>
                    <Table.ColumnHeaderCell>Client</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Day type</Table.ColumnHeaderCell>
                    {role !== "client_admin" && <Table.ColumnHeaderCell>Pay rate</Table.ColumnHeaderCell>}
                    {role !== "coordinator" && <Table.ColumnHeaderCell>Bill rate</Table.ColumnHeaderCell>}
                    {role === "super_admin" && <Table.ColumnHeaderCell>Margin</Table.ColumnHeaderCell>}
                  </Table.Row></Table.Header>
                  <Table.Body>
                    {rates?.map((r) => (
                      <Table.Row key={r.id}>
                        <Table.Cell>{r.clientName}</Table.Cell><Table.Cell>{r.role}</Table.Cell><Table.Cell>{r.dayType}</Table.Cell>
                        {role !== "client_admin" && <Table.Cell>{fmtMoney(r.payRate)}</Table.Cell>}
                        {role !== "coordinator" && <Table.Cell>{fmtMoney(r.billRate)}</Table.Cell>}
                        {role === "super_admin" && <Table.Cell>{fmtMoney(r.billRate! - r.payRate!)}</Table.Cell>}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>
            </Tabs.Content>
          </Tabs.Root>
        )}
      </Load>
    </>
  );
}

function TimesheetTable({ rows, role, onUpdate }: { rows: TS[]; role: Role; onUpdate: (id: string, b: { status: string; note?: string }) => void }) {
  if (!rows.length) return <Empty>Nothing here.</Empty>;
  return (
    <Card mt="3" style={{ overflowX: "auto" }}>
      <Table.Root size="1">
        <Table.Header><Table.Row>
          <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Site</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Hours</Table.ColumnHeaderCell>
          {role !== "client_admin" && <Table.ColumnHeaderCell>Pay</Table.ColumnHeaderCell>}
          {role !== "coordinator" && <Table.ColumnHeaderCell>Bill</Table.ColumnHeaderCell>}
          <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
        </Table.Row></Table.Header>
        <Table.Body>
          {rows.map((t) => {
            const canApprove = t.status !== "approved" && (role !== "coordinator" || t.status === "disputed");
            return (
              <Table.Row key={t.id}>
                <Table.Cell>{fmtDate(t.date)}</Table.Cell>
                <Table.Cell>{t.workerName}</Table.Cell>
                <Table.Cell>{t.siteName}</Table.Cell>
                <Table.Cell>{fmtHours(t.hours)}{t.breakMins > 0 && <Text color="gray" size="1"> ({t.breakMins}m break)</Text>}</Table.Cell>
                {role !== "client_admin" && <Table.Cell>{fmtMoney(t.hours * t.payRate!)}</Table.Cell>}
                {role !== "coordinator" && <Table.Cell>{fmtMoney(t.hours * t.billRate!)}</Table.Cell>}
                <Table.Cell><StatusBadge status={t.status} />{t.note && <Text as="div" size="1" color="gray">{t.note}</Text>}</Table.Cell>
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
    </Card>
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
