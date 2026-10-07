"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, Flex, Table, Tabs, Text } from "@radix-ui/themes";
import { ApiError, fmtDate, useApi, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, PageHeader } from "@/components/ui";
import type { WorkerDocument } from "@/lib/types";

type Doc = WorkerDocument & { workerName: string };
const BUCKETS = [
  { key: "expired", label: "Expired", test: (d: number) => d < 0, color: "red" },
  { key: "7", label: "≤ 7 days", test: (d: number) => d >= 0 && d <= 7, color: "orange" },
  { key: "14", label: "≤ 14 days", test: (d: number) => d > 7 && d <= 14, color: "amber" },
  { key: "30", label: "≤ 30 days", test: (d: number) => d > 14 && d <= 30, color: "yellow" },
] as const;

export default function CompliancePage() {
  const send = useSend();
  const { data, error, reload } = useApi<Doc[]>("/documents");
  const [actionError, setActionError] = useState<ApiError>();

  async function decide(id: string, status: "verified" | "rejected") {
    try {
      setActionError(undefined);
      await send(`/documents/${id}`, "PATCH", { status });
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <>
      <PageHeader title="Compliance" subtitle="Verify uploaded documents and track expiries. Workers with expired mandatory documents cannot be booked." />
      <ErrorCallout error={actionError} />
      <Load data={data} error={error}>
        {(docs) => {
          const pending = docs.filter((d) => d.status === "pending");
          const withDays = docs
            .filter((d) => d.expiresOn)
            .map((d) => ({ ...d, days: Math.ceil((Date.parse(d.expiresOn!) - Date.now()) / 864e5) }))
            .sort((a, b) => a.days - b.days);
          return (
            <Tabs.Root defaultValue="queue">
              <Tabs.List>
                <Tabs.Trigger value="queue">Verification queue <Badge ml="2" color={pending.length ? "amber" : "gray"}>{pending.length}</Badge></Tabs.Trigger>
                <Tabs.Trigger value="expiry">Expiry tracker</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="queue">
                {pending.length === 0 ? <Empty>No documents waiting for verification.</Empty> : (
                  <Card mt="3">
                    <Table.Root size="1">
                      <Table.Header><Table.Row>
                        <Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Document</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>File</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Uploaded</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
                      </Table.Row></Table.Header>
                      <Table.Body>
                        {pending.map((d) => (
                          <Table.Row key={d.id}>
                            <Table.Cell><Link href={`/workers/${d.workerId}`}>{d.workerName}</Link></Table.Cell>
                            <Table.Cell>{d.type}</Table.Cell>
                            <Table.Cell><Text size="1" color="gray">{d.fileName}</Text></Table.Cell>
                            <Table.Cell>{fmtDate(d.uploadedAt)}</Table.Cell>
                            <Table.Cell>
                              <Flex gap="2">
                                <Button size="1" color="green" onClick={() => decide(d.id, "verified")}>Verify</Button>
                                <Button size="1" color="red" variant="soft" onClick={() => decide(d.id, "rejected")}>Reject</Button>
                              </Flex>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Card>
                )}
              </Tabs.Content>
              <Tabs.Content value="expiry">
                {BUCKETS.map((b) => {
                  const rows = withDays.filter((d) => b.test(d.days));
                  return (
                    <Card key={b.key} mt="3">
                      <Flex align="center" gap="2" mb="2"><Badge color={b.color}>{b.label}</Badge><Text size="2" color="gray">{rows.length} documents</Text></Flex>
                      {rows.length > 0 && (
                        <Table.Root size="1">
                          <Table.Body>
                            {rows.map((d) => (
                              <Table.Row key={d.id}>
                                <Table.Cell><Link href={`/workers/${d.workerId}`}>{d.workerName}</Link></Table.Cell>
                                <Table.Cell>{d.type}</Table.Cell>
                                <Table.Cell>{fmtDate(d.expiresOn!)}</Table.Cell>
                                <Table.Cell>{d.days < 0 ? `${-d.days} days ago` : `${d.days} days left`}</Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      )}
                    </Card>
                  );
                })}
              </Tabs.Content>
            </Tabs.Root>
          );
        }}
      </Load>
    </>
  );
}
