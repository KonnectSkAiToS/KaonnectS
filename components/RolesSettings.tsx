"use client";
import { useState } from "react";
import { Badge, Box, Button, Card, Dialog, Flex, Select, Switch, Table, Text, TextArea, TextField } from "@radix-ui/themes";
import { MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import { ApiError, fmtMoney, useRoles, useSend } from "@/lib/client";
import { ErrorCallout, Load } from "@/components/ui";
import { MultiSelect } from "@/components/MultiSelect";
import type { JobRole } from "@/lib/types";

const SECTOR_LABEL = { care: "Care", hospitality: "Hospitality", any: "Any client" } as const;
// Suggestions for required documents; agencies can add their own names too.
const COMMON_DOCS = ["DBS Enhanced", "Manual Handling", "Safeguarding", "Food Hygiene", "First Aid", "Medication Training", "NMC PIN", "Moving & Handling", "Infection Control", "Driving Licence"];
const MIN_PAY_RATE = 12.21;

/** Configuration → Workforce → Job roles: the job roles this agency staffs, what each needs, and what it pays by default. */
export function RolesSettings({ readOnly = false }: { readOnly?: boolean }) {
  const { roles, error, reload } = useRoles();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  return (
    <Flex direction="column" gap="3" mt="3">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Flex gap="3" align="center" wrap="wrap">
          <TextField.Root placeholder="Search roles" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }}>
            <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
          </TextField.Root>
          <Text as="label" size="2"><Flex gap="2" align="center"><Switch checked={showInactive} onCheckedChange={setShowInactive} /> Show inactive</Flex></Text>
        </Flex>
        {!readOnly && <RoleDialog existing={roles ?? []} onSaved={reload} />}
      </Flex>
      <Text size="2" color="gray">
        Roles appear when posting shifts and adding rate cards. A worker needs every document listed for each of their roles, plus Right to Work and References.
      </Text>
      <Load data={roles} error={error}>
        {(rows) => {
          const shown = rows.filter((r) => (showInactive || r.active) && `${r.name} ${r.description ?? ""}`.toLowerCase().includes(q.toLowerCase()));
          return (
            <Card style={{ overflowX: "auto" }}>
              <Table.Root size="1">
                <Table.Header><Table.Row>
                  <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Offered for</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Required documents</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Default pay</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>In use</Table.ColumnHeaderCell>{!readOnly && <Table.ColumnHeaderCell />}
                </Table.Row></Table.Header>
                <Table.Body>
                  {shown.map((r) => (
                    <Table.Row key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                      <Table.Cell>
                        <Text weight="medium">{r.name}</Text> {!r.active && <Badge color="gray">inactive</Badge>}
                        {r.description && <Text as="div" size="1" color="gray">{r.description}</Text>}
                      </Table.Cell>
                      <Table.Cell><Badge color={r.sector === "care" ? "violet" : r.sector === "hospitality" ? "teal" : "gray"}>{SECTOR_LABEL[r.sector]}</Badge></Table.Cell>
                      <Table.Cell><Flex gap="1" wrap="wrap">{r.requiredDocs.length ? r.requiredDocs.map((d) => <Badge key={d} color="gray">{d}</Badge>) : <Text size="1" color="gray">Base documents only</Text>}</Flex></Table.Cell>
                      <Table.Cell>{r.defaultPayRate != null ? `${fmtMoney(r.defaultPayRate)}/h` : <Text color="gray">—</Text>}</Table.Cell>
                      <Table.Cell><Text size="1">{r.usage.workers} workers · {r.usage.upcomingShifts} upcoming shifts · {r.usage.rateCards} rates</Text></Table.Cell>
                      {!readOnly && <Table.Cell><RoleDialog role={r} existing={rows} onSaved={reload} /></Table.Cell>}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
              {!shown.length && <Text as="p" size="2" color="gray" m="2">No roles match.</Text>}
            </Card>
          );
        }}
      </Load>
    </Flex>
  );
}

/** Add (no `role`) or edit a role. Renaming carries through to workers, shifts and rate cards. */
function RoleDialog({ role, existing, onSaved }: { role?: JobRole; existing: JobRole[]; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const init = () => ({
    name: role?.name ?? "", sector: role?.sector ?? "any", description: role?.description ?? "",
    requiredDocs: role?.requiredDocs ?? [], defaultPayRate: role?.defaultPayRate != null ? String(role.defaultPayRate) : "", active: role?.active ?? true,
  });
  const [f, setF] = useState(init);
  const [newDoc, setNewDoc] = useState("");
  const docOptions = [...new Set([...COMMON_DOCS, ...existing.flatMap((r) => r.requiredDocs), ...f.requiredDocs])].sort();
  const renamed = role && f.name.trim() && f.name.trim() !== role.name;
  const inUse = role && (role.usage.workers + role.usage.upcomingShifts + role.usage.rateCards) > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = { ...f, defaultPayRate: f.defaultPayRate ? Number(f.defaultPayRate) : null, description: f.description.trim() || null };
      if (role) await send(`/roles/${role.id}`, "PATCH", body);
      else await send("/roles", "POST", body);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) { setF(init()); setNewDoc(""); } }}>
      <Dialog.Trigger>{role ? <Button size="1" variant="soft">Edit</Button> : <Button><PlusIcon /> Add role</Button>}</Dialog.Trigger>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>{role ? `Edit ${role.name}` : "Add role"}</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            <label><Text as="div" size="2" weight="medium" mb="1">Name</Text>
              <TextField.Root value={f.name} maxLength={60} placeholder="e.g. Activities Coordinator" onChange={(e) => setF({ ...f, name: e.target.value })} />
              {renamed && inUse && <Text size="1" color="amber">Renaming updates {role!.usage.workers} workers, their shifts and {role!.usage.rateCards} rate cards.</Text>}
            </label>
            <Flex gap="3">
              <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">Offered for</Text>
                <Select.Root value={f.sector} onValueChange={(sector) => setF({ ...f, sector: sector as JobRole["sector"] })}>
                  <Select.Trigger style={{ width: "100%" }} />
                  <Select.Content>{Object.entries(SECTOR_LABEL).map(([k, v]) => <Select.Item key={k} value={k}>{v}</Select.Item>)}</Select.Content>
                </Select.Root>
              </label>
              <label style={{ flex: 1 }}><Text as="div" size="2" weight="medium" mb="1">Default pay (£/h, optional)</Text>
                <TextField.Root type="number" step="0.01" min={MIN_PAY_RATE} value={f.defaultPayRate} onChange={(e) => setF({ ...f, defaultPayRate: e.target.value })} />
              </label>
            </Flex>
            <Text size="1" color="gray">Default pay seeds weekday/weekend/night rate cards when a new client of that sector is added.</Text>
            <label><Text as="div" size="2" weight="medium" mb="1">Description (optional)</Text>
              <TextArea rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </label>
            <div>
              <Text as="div" size="2" weight="medium" mb="1">Required documents</Text>
              <MultiSelect noun="document" height={180} value={f.requiredDocs} onChange={(requiredDocs) => setF({ ...f, requiredDocs })}
                options={docOptions.map((d) => ({ id: d, label: d }))} allowEmpty />
              <Flex gap="2" mt="2">
                <Box flexGrow="1"><TextField.Root size="1" placeholder="Add another document type" value={newDoc} maxLength={80} onChange={(e) => setNewDoc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newDoc.trim()) { setF({ ...f, requiredDocs: [...new Set([...f.requiredDocs, newDoc.trim()])] }); setNewDoc(""); } } }} /></Box>
                <Button type="button" size="1" variant="soft" disabled={!newDoc.trim()}
                  onClick={() => { setF({ ...f, requiredDocs: [...new Set([...f.requiredDocs, newDoc.trim()])] }); setNewDoc(""); }}>Add</Button>
              </Flex>
            </div>
            {role && (
              <Text as="label" size="2"><Flex gap="2" align="center"><Switch checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} /> Active</Flex>
                {!f.active && <Text as="div" size="1" color="gray">Inactive roles can't be used for new shifts or rate cards. Existing shifts, rates and workers keep it.</Text>}
              </Text>
            )}
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.name.trim()}>{role ? "Save" : "Add role"}</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
