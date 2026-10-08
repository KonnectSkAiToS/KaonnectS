"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Box, Button, Card, Flex, Heading, Separator, Table, Text } from "@radix-ui/themes";
import { ArrowLeftIcon, DownloadIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtMoney, useApi, useRole, useSend } from "@/lib/client";
import { ErrorCallout, InvoiceBadge, Load } from "@/components/ui";
import { ReloadButton } from "@/components/ReloadButton";
import type { Client, Invoice, Tenant } from "@/lib/types";

interface Detail { invoice: Invoice & { overdue: boolean }; client: Client; agency: Tenant }
const dayOnly = (s: string) => fmtDate(`${s}T00:00`);

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useRole();
  const send = useSend();
  const { data, error, reload } = useApi<Detail>(`/invoices/${id}`);
  const [actionError, setActionError] = useState<ApiError>();

  async function act(action: string) {
    if (action === "void" && !confirm("Void this invoice? Its timesheets become billable again.")) return;
    try {
      setActionError(undefined);
      await send(`/invoices/${id}`, "PATCH", { action });
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <>
      <Flex justify="between" align="center" mb="4" gap="3" wrap="wrap" className="no-print">
        <Link href="/invoices" style={{ textDecoration: "none" }}><Text size="2" color="gray"><Flex align="center" gap="1"><ArrowLeftIcon /> All invoices</Flex></Text></Link>
        {data && (
          <Flex gap="2" wrap="wrap">
            {role === "super_admin" && data.invoice.status === "draft" && <Button onClick={() => act("issue")}>Issue to client</Button>}
            {role === "super_admin" && data.invoice.status === "issued" && <Button color="green" onClick={() => act("mark_paid")}>Mark as paid</Button>}
            {role === "super_admin" && ["draft", "issued"].includes(data.invoice.status) && <Button variant="soft" color="red" onClick={() => act("void")}>Void</Button>}
            <Button variant="soft" onClick={() => window.print()}><DownloadIcon /> Print / save PDF</Button>
            <ReloadButton />
          </Flex>
        )}
      </Flex>
      <ErrorCallout error={actionError} />
      <Load data={data} error={error}>
        {({ invoice: inv, client, agency }) => (
          <Card size="4" className="invoice">
            <Flex justify="between" wrap="wrap" gap="4">
              <Box>
                <Heading size="6" color={agency.brandColor}>{agency.name}</Heading>
                <Text as="div" size="2" color="gray">{agency.domain}</Text>
              </Box>
              <Box style={{ textAlign: "right" }}>
                <Heading size="5">Invoice {inv.number}</Heading>
                <Flex justify="end" mt="1"><InvoiceBadge status={inv.status} overdue={inv.overdue} /></Flex>
              </Box>
            </Flex>
            <Separator size="4" my="4" />
            <Flex justify="between" wrap="wrap" gap="4" mb="4">
              <Box>
                <Text as="div" size="1" color="gray">Bill to</Text>
                <Text as="div" weight="bold">{client.name}</Text>
                <Text as="div" size="2">{client.contact} · {client.email}</Text>
              </Box>
              <Box style={{ textAlign: "right" }}>
                <Text as="div" size="2">Period: {dayOnly(inv.periodFrom)} – {dayOnly(inv.periodTo)}</Text>
                {inv.issuedAt && <Text as="div" size="2">Issued: {fmtDate(inv.issuedAt)}</Text>}
                {inv.dueDate && <Text as="div" size="2" color={inv.overdue ? "red" : undefined}>Due: {dayOnly(inv.dueDate)}</Text>}
                {inv.paidAt && <Text as="div" size="2" color="green">Paid: {fmtDate(inv.paidAt)}</Text>}
              </Box>
            </Flex>
            <Box style={{ overflowX: "auto" }}>
              <Table.Root size="1">
                <Table.Header><Table.Row>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Site</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">Hours</Table.ColumnHeaderCell><Table.ColumnHeaderCell justify="end">Rate</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">Amount</Table.ColumnHeaderCell>
                </Table.Row></Table.Header>
                <Table.Body>
                  {inv.lines.map((l) => (
                    <Table.Row key={l.timesheetId}>
                      <Table.Cell>{dayOnly(l.date)}</Table.Cell><Table.Cell>{l.workerName}</Table.Cell>
                      <Table.Cell>{l.siteName}</Table.Cell><Table.Cell>{l.role}</Table.Cell>
                      <Table.Cell justify="end">{l.hours.toFixed(2)}</Table.Cell>
                      <Table.Cell justify="end">{fmtMoney(l.rate)}</Table.Cell>
                      <Table.Cell justify="end">{fmtMoney(l.amount)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
            <Flex direction="column" align="end" gap="1" mt="4">
              <Text size="2">Subtotal: {fmtMoney(inv.subtotal)}</Text>
              <Text size="2">VAT (20%): {fmtMoney(inv.vat)}</Text>
              <Text size="4" weight="bold">Total: {fmtMoney(inv.total)}</Text>
            </Flex>
            <Text as="p" size="1" color="gray" mt="5">Payment terms: 14 days from issue. Please quote {inv.number} with your payment.</Text>
          </Card>
        )}
      </Load>
    </>
  );
}
