"use client";
import { Badge, Card, Table, Tabs, Text } from "@radix-ui/themes";
import { ROLE_LABEL, fmtDateTime, useApi } from "@/lib/client";
import { Load, PageHeader } from "@/components/ui";
import type { AuditEntry, User } from "@/lib/types";

export default function SettingsPage() {
  const users = useApi<(User & { clients: string[] })[]>("/users");
  const audit = useApi<AuditEntry[]>("/audit");
  return (
    <>
      <PageHeader title="Settings & Audit" subtitle="Portal users and the append-only audit trail." />
      <Tabs.Root defaultValue="users">
        <Tabs.List>
          <Tabs.Trigger value="users">Users & roles</Tabs.Trigger>
          <Tabs.Trigger value="audit">Audit log</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="users">
          <Load data={users.data} error={users.error}>
            {(rows) => (
              <Card mt="3">
                <Table.Root size="1">
                  <Table.Header><Table.Row>
                    <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Scope</Table.ColumnHeaderCell>
                  </Table.Row></Table.Header>
                  <Table.Body>
                    {rows.map((u) => (
                      <Table.Row key={u.id}>
                        <Table.Cell>{u.name}</Table.Cell><Table.Cell>{u.email}</Table.Cell>
                        <Table.Cell><Badge>{ROLE_LABEL[u.role]}</Badge></Table.Cell>
                        <Table.Cell><Text size="1">{u.clients.join(", ")}</Text></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>
            )}
          </Load>
        </Tabs.Content>
        <Tabs.Content value="audit">
          <Load data={audit.data} error={audit.error}>
            {(rows) => (
              <Card mt="3">
                <Table.Root size="1">
                  <Table.Header><Table.Row>
                    <Table.ColumnHeaderCell>When</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Who</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Detail</Table.ColumnHeaderCell>
                  </Table.Row></Table.Header>
                  <Table.Body>
                    {rows.map((a) => (
                      <Table.Row key={a.id}>
                        <Table.Cell>{fmtDateTime(a.at)}</Table.Cell><Table.Cell>{a.actor}</Table.Cell>
                        <Table.Cell><code>{a.action}</code></Table.Cell><Table.Cell>{a.detail}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>
            )}
          </Load>
        </Tabs.Content>
      </Tabs.Root>
    </>
  );
}
