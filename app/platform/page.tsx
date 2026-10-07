"use client";
import { useState } from "react";
import { Badge, Box, Button, Callout, Card, Dialog, Flex, Grid, Heading, Select, Table, Text, TextField } from "@radix-ui/themes";
import { InfoCircledIcon, PlusIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtMoney, useApi, useSend } from "@/lib/client";
import { ErrorCallout, Load, PageHeader } from "@/components/ui";
import { useThemeMode } from "@/components/AppTheme";
import type { Plan, Tenant } from "@/lib/types";

type Row = Tenant & { current: boolean; monthlyPrice: number; usage: { workers: number; sites: number } };
interface Current extends Tenant { usage: { workers: number; sites: number }; limits: { workers: number | null; sites: number | null } }

const COLORS: Tenant["brandColor"][] = ["indigo", "teal", "crimson", "amber", "violet", "green", "blue", "orange"];
const PLANS: Plan[] = ["starter", "growth", "enterprise"];
const STATUS_COLOR = { active: "green", trial: "amber", suspended: "red" } as const;

export default function PlatformPage() {
  const { reloadBrand } = useThemeMode();
  const tenants = useApi<Row[]>("/tenants");
  const current = useApi<Current>("/tenant");
  const reload = () => { tenants.reload(); current.reload(); reloadBrand(); };

  return (
    <>
      <PageHeader title="Platform & Tenants" subtitle="White-label the platform: each agency gets its own branding, domain, plan and isolated data.">
        <ProvisionTenant onCreated={reload} />
      </PageHeader>

      <Load data={current.data} error={current.error}>
        {(t) => (
          <Card mb="5">
            <Flex justify="between" align="start" wrap="wrap" gap="4">
              <Box>
                <Text size="1" color="gray">This portal</Text>
                <Heading size="5">{t.name}</Heading>
                <Text size="2" color="gray">{t.domain} · {t.plan} plan</Text>
              </Box>
              <EditTenant tenant={t} label="Edit branding & plan" onSaved={reload} />
            </Flex>
            <Grid columns={{ initial: "1", sm: "2" }} gap="4" mt="4">
              <Usage label="Workers" used={t.usage.workers} limit={t.limits.workers} />
              <Usage label="Sites" used={t.usage.sites} limit={t.limits.sites} />
            </Grid>
          </Card>
        )}
      </Load>

      <Callout.Root size="1" mb="3">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>Demo: only this portal's agency has data. In production every table carries a tenant ID and Postgres row-level security keeps each agency's data separate.</Callout.Text>
      </Callout.Root>

      <Load data={tenants.data} error={tenants.error}>
        {(rows) => (
          <Card style={{ overflowX: "auto" }}>
            <Table.Root size="1">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Agency</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Domain</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Plan</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Usage</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Since</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
              </Table.Row></Table.Header>
              <Table.Body>
                {rows.map((t) => (
                  <Table.Row key={t.id}>
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: `var(--${t.brandColor}-9)`, flexShrink: 0 }} />
                        <Text weight="medium">{t.name}</Text>{t.current && <Badge>this portal</Badge>}
                      </Flex>
                      <Text as="div" size="1" color="gray">{t.adminEmail}</Text>
                    </Table.Cell>
                    <Table.Cell><Text size="1">{t.domain}</Text></Table.Cell>
                    <Table.Cell>{t.plan}<Text as="div" size="1" color="gray">{fmtMoney(t.monthlyPrice)}/mo</Text></Table.Cell>
                    <Table.Cell><Text size="1">{t.usage.workers} workers · {t.usage.sites} sites</Text></Table.Cell>
                    <Table.Cell><Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge></Table.Cell>
                    <Table.Cell>{fmtDate(t.createdAt)}</Table.Cell>
                    <Table.Cell><EditTenant tenant={t} label="Edit" onSaved={reload} /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        )}
      </Load>
    </>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <Box>
      <Flex justify="between" mb="1"><Text size="2">{label}</Text><Text size="2" color="gray">{used} / {limit ?? "unlimited"}</Text></Flex>
      <div className="bar"><span style={{ width: `${limit ? pct : 5}%`, background: pct > 90 ? "var(--red-9)" : undefined }} /></div>
    </Box>
  );
}

function ColorPicker({ value, onChange }: { value: Tenant["brandColor"]; onChange: (c: Tenant["brandColor"]) => void }) {
  return (
    <Flex gap="2" wrap="wrap">
      {COLORS.map((c) => (
        <button key={c} type="button" aria-label={c} title={c} onClick={() => onChange(c)} style={{
          width: 28, height: 28, borderRadius: 6, cursor: "pointer", background: `var(--${c}-9)`,
          border: value === c ? "3px solid var(--gray-12)" : "3px solid transparent",
        }} />
      ))}
    </Flex>
  );
}

function EditTenant({ tenant, label, onSaved }: { tenant: Tenant; label: string; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [f, setF] = useState({ name: tenant.name, domain: tenant.domain, brandColor: tenant.brandColor, plan: tenant.plan, status: tenant.status });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send(`/tenants/${tenant.id}`, "PATCH", f);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => {
      setOpen(o); setError(undefined);
      if (o) setF({ name: tenant.name, domain: tenant.domain, brandColor: tenant.brandColor, plan: tenant.plan, status: tenant.status });
    }}>
      <Dialog.Trigger><Button size="1" variant="soft">{label}</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>{tenant.name}</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            <label><Text as="div" size="2" weight="medium" mb="1">Agency name</Text><TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label><Text as="div" size="2" weight="medium" mb="1">Custom domain</Text><TextField.Root value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value.toLowerCase() })} /></label>
            <div><Text as="div" size="2" weight="medium" mb="1">Brand colour</Text><ColorPicker value={f.brandColor} onChange={(brandColor) => setF({ ...f, brandColor })} /></div>
            <Flex gap="3">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" weight="medium" mb="1">Plan</Text>
                <Select.Root value={f.plan} onValueChange={(plan) => setF({ ...f, plan: plan as Plan })}>
                  <Select.Trigger style={{ width: "100%" }} />
                  <Select.Content>{PLANS.map((p) => <Select.Item key={p} value={p}>{p}</Select.Item>)}</Select.Content>
                </Select.Root>
              </label>
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" weight="medium" mb="1">Status</Text>
                <Select.Root value={f.status} onValueChange={(status) => setF({ ...f, status: status as Tenant["status"] })}>
                  <Select.Trigger style={{ width: "100%" }} />
                  <Select.Content>{(["active", "trial", "suspended"] as const).map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}</Select.Content>
                </Select.Root>
              </label>
            </Flex>
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit">Save</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function ProvisionTenant({ onCreated }: { onCreated: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const empty = { name: "", slug: "", adminEmail: "", plan: "starter" as Plan, brandColor: "indigo" as Tenant["brandColor"] };
  const [f, setF] = useState(empty);
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/tenants", "POST", f);
      setOpen(false);
      setF(empty);
      onCreated();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
      <Dialog.Trigger><Button><PlusIcon /> New agency</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Set up a new agency</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">Starts on a trial. The admin gets an invite email to set up their account.</Dialog.Description>
        <ErrorCallout error={error} />
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <label><Text as="div" size="2" weight="medium" mb="1">Agency name</Text>
              <TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: f.slug === slugify(f.name) ? slugify(e.target.value) : f.slug })} />
            </label>
            <label><Text as="div" size="2" weight="medium" mb="1">Slug</Text>
              <TextField.Root value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} />
              <Text size="1" color="gray">Default address: {f.slug || "slug"}.staffing-platform.example</Text>
            </label>
            <label><Text as="div" size="2" weight="medium" mb="1">Admin email</Text>
              <TextField.Root type="email" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} />
            </label>
            <label><Text as="div" size="2" weight="medium" mb="1">Plan</Text>
              <Select.Root value={f.plan} onValueChange={(plan) => setF({ ...f, plan: plan as Plan })}>
                <Select.Trigger style={{ width: "100%" }} />
                <Select.Content>{PLANS.map((p) => <Select.Item key={p} value={p}>{p}</Select.Item>)}</Select.Content>
              </Select.Root>
            </label>
            <div><Text as="div" size="2" weight="medium" mb="1">Brand colour</Text><ColorPicker value={f.brandColor} onChange={(brandColor) => setF({ ...f, brandColor })} /></div>
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.name.trim() || !f.slug || !f.adminEmail}>Create agency</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
