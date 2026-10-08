"use client";
import { Suspense, useDeferredValue, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, Dialog, Flex, Select, Switch, Table, Tabs, Text, TextArea, TextField } from "@radix-ui/themes";
import { DownloadIcon, MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import { ApiError, downloadFile, ukDate, ROLE_LABEL, fmtDate, fmtDateTime, useApi, useAuth, useRole, useSend } from "@/lib/client";
import { ErrorCallout, Load, PageHeader } from "@/components/ui";
import { Pager, SortHeader, useTable } from "@/components/table";
import type { AuditEntry, Client, Role, Site, User } from "@/lib/types";
import { MultiSelect } from "@/components/MultiSelect";

type U = User & { clients: string[] };
type ClientWithSites = Client & { sites: Site[] };
const ROLES: Role[] = ["super_admin", "coordinator", "client_admin"];
const STATUS_COLOR = { active: "green", invited: "amber", deactivated: "gray" } as const;

export default function SettingsPage() {
  return <Suspense><Settings /></Suspense>;
}

const TABS = ["users", "audit"];

function Settings() {
  const params = useSearchParams();
  const tab = TABS.includes(params.get("tab") ?? "") ? params.get("tab")! : "users";
  return (
    <>
      <PageHeader title="Settings & Audit" subtitle="Portal users and the audit trail. Business setup lives under Configuration." />
      <Tabs.Root defaultValue={tab}>
        <Tabs.List>
          <Tabs.Trigger value="users">Users</Tabs.Trigger>
          <Tabs.Trigger value="audit">Audit log</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="users"><Users /></Tabs.Content>
        <Tabs.Content value="audit"><Audit /></Tabs.Content>
      </Tabs.Root>
    </>
  );
}

// ---------- Users ----------

function Users() {
  const send = useSend();
  const { data, error, reload } = useApi<U[]>("/users");
  const { data: clients } = useApi<ClientWithSites[]>("/clients");
  const [actionError, setActionError] = useState<ApiError>();

  async function patch(id: string, b: object) {
    try {
      setActionError(undefined);
      await send(`/users/${id}`, "PATCH", b);
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <Flex direction="column" gap="3" mt="3">
      <Flex justify="end"><UserDialog clients={clients ?? []} onSaved={reload} /></Flex>
      <ErrorCallout error={actionError} />
      <Load data={data} error={error}>
        {(rows) => (
          <Card style={{ overflowX: "auto" }}>
            <Table.Root size="1">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Scope</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
              </Table.Row></Table.Header>
              <Table.Body>
                {rows.map((u) => (
                  <Table.Row key={u.id} style={{ opacity: u.status === "deactivated" ? 0.6 : 1 }}>
                    <Table.Cell><Text weight="medium">{u.name}</Text><Text as="div" size="1" color="gray">{u.email}</Text></Table.Cell>
                    <Table.Cell><Badge>{ROLE_LABEL[u.role]}</Badge></Table.Cell>
                    <Table.Cell><Text size="1">{u.clients.join(", ")}</Text></Table.Cell>
                    <Table.Cell>
                      <Badge color={STATUS_COLOR[u.status]}>{u.status}</Badge>
                      {u.status === "invited" && u.invitedAt && <Text as="div" size="1" color="gray">sent {fmtDate(u.invitedAt)}</Text>}
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2" justify="end" wrap="wrap">
                        {u.status === "invited" && <Button size="1" variant="soft" onClick={() => patch(u.id, { resendInvite: true })}>Resend</Button>}
                        <UserDialog user={u} clients={clients ?? []} onSaved={reload} />
                        {u.status === "deactivated"
                          ? <Button size="1" variant="soft" color="green" onClick={() => patch(u.id, { status: "active" })}>Reactivate</Button>
                          : <Button size="1" variant="soft" color="red" onClick={() => confirm(`Deactivate ${u.name}? They'll lose access immediately.`) && patch(u.id, { status: "deactivated" })}>Deactivate</Button>}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        )}
      </Load>
    </Flex>
  );
}

/** Invite (no `user`) or edit role/clients (with `user`). */
function UserDialog({ user, clients, onSaved }: { user?: U; clients: ClientWithSites[]; onSaved: () => void }) {
  const send = useSend();
  const { user: me } = useAuth();
  const isMe = !!user && user.email.toLowerCase() === me?.email.toLowerCase();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const init = () => ({ name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? ("coordinator" as Role), clientIds: user?.clientIds ?? [] });
  const [f, setF] = useState(init);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (user) await send(`/users/${user.id}`, "PATCH", { name: f.name, email: f.email, role: f.role, clientIds: f.clientIds });
      else await send("/users", "POST", f);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setF(init()); }}>
      <Dialog.Trigger>{user ? <Button size="1" variant="soft">Edit</Button> : <Button><PlusIcon /> Invite user</Button>}</Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>{user ? `Edit ${user.name}` : "Invite user"}</Dialog.Title>
        {!user && <Dialog.Description size="2" color="gray" mb="3">They'll get an email to set a password and turn on two-factor sign-in.</Dialog.Description>}
        <ErrorCallout error={error} />
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <label><Text as="div" size="2" weight="medium" mb="1">Name</Text><TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label><Text as="div" size="2" weight="medium" mb="1">Email</Text><TextField.Root type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Role</Text>
              <Select.Root value={f.role} onValueChange={(role) => setF({ ...f, role: role as Role })} disabled={isMe}>
                <Select.Trigger style={{ width: "100%" }} />
                <Select.Content>{ROLES.map((r) => <Select.Item key={r} value={r}>{ROLE_LABEL[r]}</Select.Item>)}</Select.Content>
              </Select.Root>
              {isMe && <Text size="1" color="gray">You can't change your own role. Ask another Super Admin.</Text>}
            </label>
            {f.role === "super_admin" ? (
              <div>
                <Text as="div" size="2" weight="medium" mb="1">Clients they can see</Text>
                <Text size="2" color="gray">All clients. Super Admins always see the whole agency.</Text>
              </div>
            ) : (
              <div>
                <Text as="div" size="2" weight="medium" mb="1">Clients they can see</Text>
                <Text as="p" size="1" color="gray" mb="2">They see every site of each selected client.</Text>
                <MultiSelect
                  noun="client"
                  value={f.clientIds}
                  onChange={(clientIds) => setF({ ...f, clientIds })}
                  options={clients.map((c) => ({ id: c.id, label: c.name, hint: `${c.sector} · ${c.sites.length} site${c.sites.length === 1 ? "" : "s"}` }))}
                />
              </div>
            )}
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.name.trim() || !f.email.trim() || (f.role !== "super_admin" && !f.clientIds.length)}>{user ? "Save" : "Send invite"}</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

// ---------- Audit log ----------

function Audit() {
  const { role } = useRole();
  const [q, setQ] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  // Filtering runs on the server (the log grows forever); deferring keeps typing smooth.
  const filter = useDeferredValue(new URLSearchParams(Object.entries({ q: q.trim(), ...range }).filter(([, v]) => v)).toString());
  const { data, error } = useApi<{ entries: AuditEntry[]; truncated: boolean }>(`/audit?${filter}`);
  const [exportError, setExportError] = useState<ApiError>();

  async function exportCsv() {
    const params = new URLSearchParams(Object.entries(range).filter(([, v]) => v));
    try {
      await downloadFile(role, `/audit/export?${params}`, `audit-log-${ukDate(new Date())}.csv`);
    } catch (e) {
      setExportError(e as ApiError);
    }
  }

  return (
    <Flex direction="column" gap="3" mt="3">
      <Flex gap="3" wrap="wrap" align="end">
        <TextField.Root placeholder="Search who, action or detail" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }}>
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
        </TextField.Root>
        <label><Text as="div" size="1" color="gray">From</Text><TextField.Root type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label><Text as="div" size="1" color="gray">To</Text><TextField.Root type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        <Button variant="soft" onClick={exportCsv}><DownloadIcon /> Export CSV</Button>
      </Flex>
      <ErrorCallout error={exportError} />
      <Load data={data} error={error}>
        {(d) => (
          <>
            {d.truncated && <Text size="2" color="gray">Showing the latest {d.entries.length} entries. Search, pick dates or export the CSV to see older ones.</Text>}
            <AuditTable rows={d.entries} />
          </>
        )}
      </Load>
    </Flex>
  );
}

function AuditTable({ rows }: { rows: AuditEntry[] }) {
  const tbl = useTable(rows, { at: (a) => a.at, actor: (a) => a.actor, action: (a) => a.action }, { key: "at", dir: "desc" }, 50);
  return (
    <Card style={{ overflowX: "auto" }}>
      <Table.Root size="1">
        <Table.Header><Table.Row>
          <SortHeader label="When" k="at" t={tbl} /><SortHeader label="Who" k="actor" t={tbl} />
          <SortHeader label="Action" k="action" t={tbl} /><Table.ColumnHeaderCell>Detail</Table.ColumnHeaderCell>
        </Table.Row></Table.Header>
        <Table.Body>
          {tbl.rows.map((a) => (
            <Table.Row key={a.id}>
              <Table.Cell>{fmtDateTime(a.at)}</Table.Cell><Table.Cell>{a.actor}</Table.Cell>
              <Table.Cell><code>{a.action}</code></Table.Cell><Table.Cell>{a.detail}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {rows.length === 0 && <Text as="p" size="2" color="gray" mt="2">No entries match.</Text>}
      <Pager {...tbl.pager} />
    </Card>
  );
}
