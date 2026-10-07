"use client";
import { useState } from "react";
import { Badge, Button, Card, Dialog, Flex, Select, Switch, Table, Tabs, Text, TextArea, TextField } from "@radix-ui/themes";
import { DownloadIcon, MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import { ApiError, ROLE_LABEL, fmtDate, fmtDateTime, useApi, useAuth, useRole, useSend } from "@/lib/client";
import { ErrorCallout, Load, PageHeader } from "@/components/ui";
import { Pager, SortHeader, useTable } from "@/components/table";
import type { AuditEntry, Client, NotificationTemplate, RetentionRule, Role, Site, User } from "@/lib/types";
import { MultiSelect } from "@/components/MultiSelect";

type U = User & { clients: string[] };
type ClientWithSites = Client & { sites: Site[] };
const ROLES: Role[] = ["super_admin", "coordinator", "client_admin"];
const STATUS_COLOR = { active: "green", invited: "amber", deactivated: "gray" } as const;

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings & Audit" subtitle="Portal users, notification messages, data retention and the audit trail." />
      <Tabs.Root defaultValue="users">
        <Tabs.List>
          <Tabs.Trigger value="users">Users & roles</Tabs.Trigger>
          <Tabs.Trigger value="templates">Notifications</Tabs.Trigger>
          <Tabs.Trigger value="retention">Data retention</Tabs.Trigger>
          <Tabs.Trigger value="audit">Audit log</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="users"><Users /></Tabs.Content>
        <Tabs.Content value="templates"><Templates /></Tabs.Content>
        <Tabs.Content value="retention"><Retention /></Tabs.Content>
        <Tabs.Content value="audit"><Audit /></Tabs.Content>
      </Tabs.Root>
    </>
  );
}

// ---------- Users ----------

function Users() {
  const send = useSend();
  const { data, error, reload } = useApi<U[]>("/users");
  const { data: clients } = useApi<ClientWithSites[]>("dummy:/clients");
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

// ---------- Notification templates ----------

const EVENT_LABEL: Record<NotificationTemplate["event"], string> = {
  "shift.matched": "New shift match", "shift.confirmed": "Shift confirmed", "shift.cancelled": "Shift cancelled",
  "shift.reminder": "Reminder 1 hour before shift", "document.expiring": "Document expiring",
  "leave.decided": "Leave approved / rejected", "timesheet.approved": "Timesheet approved",
};
const LIMIT = { push: 178, sms: 160, email: 5000 } as const;

function Templates() {
  const send = useSend();
  const { data, error, reload } = useApi<NotificationTemplate[]>("/templates");
  const [actionError, setActionError] = useState<ApiError>();

  async function toggle(t: NotificationTemplate, enabled: boolean) {
    try {
      setActionError(undefined);
      await send(`/templates/${t.id}`, "PATCH", { enabled });
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <Flex direction="column" gap="3" mt="3">
      <Text size="2" color="gray">
        {"Placeholders like {{site}} and {{date}} are filled in when the message is sent. SMS is limited to 160 characters."}
      </Text>
      <ErrorCallout error={actionError} />
      <Load data={data} error={error}>
        {(rows) => (
          <Card style={{ overflowX: "auto" }}>
            <Table.Root size="1">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Event</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Channel</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Message</Table.ColumnHeaderCell><Table.ColumnHeaderCell>On</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
              </Table.Row></Table.Header>
              <Table.Body>
                {rows.map((t) => (
                  <Table.Row key={t.id}>
                    <Table.Cell><Text weight="medium">{EVENT_LABEL[t.event]}</Text></Table.Cell>
                    <Table.Cell><Badge color={t.channel === "sms" ? "orange" : t.channel === "email" ? "blue" : "gray"}>{t.channel}</Badge></Table.Cell>
                    <Table.Cell style={{ maxWidth: 480 }}>
                      {t.subject && <Text as="div" size="1" weight="medium">{t.subject}</Text>}
                      <Text size="1" color="gray" style={{ whiteSpace: "pre-wrap" }}>{t.body}</Text>
                    </Table.Cell>
                    <Table.Cell><Switch checked={t.enabled} onCheckedChange={(v) => toggle(t, v)} aria-label={`Enable ${EVENT_LABEL[t.event]}`} /></Table.Cell>
                    <Table.Cell><TemplateDialog t={t} onSaved={reload} /></Table.Cell>
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

function TemplateDialog({ t, onSaved }: { t: NotificationTemplate; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [f, setF] = useState({ subject: t.subject ?? "", body: t.body });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send(`/templates/${t.id}`, "PATCH", t.channel === "email" ? f : { body: f.body });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setF({ subject: t.subject ?? "", body: t.body }); }}>
      <Dialog.Trigger><Button size="1" variant="soft">Edit</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>{EVENT_LABEL[t.event]} · {t.channel}</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            {t.channel === "email" && (
              <label><Text as="div" size="2" weight="medium" mb="1">Subject</Text><TextField.Root value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
            )}
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Message</Text>
              <TextArea rows={t.channel === "email" ? 8 : 4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
              <Text size="1" color={f.body.length > LIMIT[t.channel] ? "red" : "gray"}>{f.body.length} / {LIMIT[t.channel]} characters</Text>
            </label>
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={f.body.length > LIMIT[t.channel]}>Save</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

// ---------- Data retention ----------

function Retention() {
  const send = useSend();
  const { data, error, reload } = useApi<RetentionRule[]>("/retention");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<ApiError>();

  async function save(r: RetentionRule) {
    try {
      setActionError(undefined);
      await send(`/retention/${r.id}`, "PATCH", { months: Number(edits[r.id]) });
      setEdits(({ [r.id]: _, ...rest }) => rest);
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <Flex direction="column" gap="3" mt="3">
      <Text size="2" color="gray">How long each kind of record is kept before it's deleted or anonymised. Set these with your compliance lead and check them against current CQC and HMRC guidance.</Text>
      <ErrorCallout error={actionError} />
      <Load data={data} error={error}>
        {(rows) => (
          <Card style={{ overflowX: "auto" }}>
            <Table.Root size="1">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Record type</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Keep for</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Counted from</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
              </Table.Row></Table.Header>
              <Table.Body>
                {rows.map((r) => {
                  const v = edits[r.id] ?? String(r.months);
                  return (
                    <Table.Row key={r.id}>
                      <Table.Cell><Text weight="medium">{r.category}</Text></Table.Cell>
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <TextField.Root type="number" min={1} max={240} value={v} style={{ width: 80 }} onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })} />
                          <Text size="1" color="gray">months{Number(v) >= 12 && ` (${(Number(v) / 12).toFixed(1).replace(".0", "")} yrs)`}</Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell><Text size="2" color="gray">{r.basis}</Text></Table.Cell>
                      <Table.Cell>{edits[r.id] !== undefined && Number(v) !== r.months && <Button size="1" onClick={() => save(r)}>Save</Button>}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Card>
        )}
      </Load>
    </Flex>
  );
}

// ---------- Audit log ----------

function Audit() {
  const { role } = useRole();
  const { data, error } = useApi<AuditEntry[]>("/audit");
  const [q, setQ] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [exportError, setExportError] = useState<ApiError>();

  async function exportCsv() {
    const params = new URLSearchParams(Object.entries(range).filter(([, v]) => v));
    const res = await fetch(`/api/audit/export?${params}`, { headers: { "x-role": role } });
    if (!res.ok) return setExportError(new ApiError("Export failed", res.status));
    const url = URL.createObjectURL(await res.blob());
    Object.assign(document.createElement("a"), { href: url, download: `audit-log-${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
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
        {(rows) => (
          <AuditTable rows={rows.filter((a) =>
            `${a.actor} ${a.action} ${a.detail}`.toLowerCase().includes(q.toLowerCase()) &&
            (!range.from || a.at.slice(0, 10) >= range.from) && (!range.to || a.at.slice(0, 10) <= range.to))} />
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
