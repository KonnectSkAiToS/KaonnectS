"use client";
import { useState } from "react";
import { Badge, Button, Card, Checkbox, Dialog, Flex, Heading, Select, Table, Text, TextField } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import { ApiError, useApi, useRole, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, PageHeader } from "@/components/ui";
import type { Client, DocType, Role, Site } from "@/lib/types";

// Right to Work and References are always required, so only the site-specific ones are choosable.
const SITE_DOCS: DocType[] = ["DBS Enhanced", "Manual Handling", "Safeguarding", "Food Hygiene"];

export default function ClientsPage() {
  const { role } = useRole();
  const { data, error, reload } = useApi<(Client & { sites: Site[] })[]>("/clients");
  return (
    <>
      <PageHeader title="Clients & Sites" subtitle="Each site has a map pin, a geofence radius for check-in, and its own compliance requirements.">
        {role === "super_admin" && <AddClient onSaved={reload} />}
      </PageHeader>
      <Load data={data} error={error}>
        {(clients) => (
          <Flex direction="column" gap="4">
            {clients.map((c) => (
              <Card key={c.id}>
                <Flex justify="between" align="start" mb="3" wrap="wrap" gap="2">
                  <div>
                    <Flex align="center" gap="2"><Heading size="4">{c.name}</Heading><Badge color={c.sector === "care" ? "violet" : "teal"}>{c.sector}</Badge></Flex>
                    <Text size="2" color="gray">{c.contact} · {c.email}</Text>
                  </div>
                  {role === "super_admin" && <AddSite client={c} onSaved={reload} />}
                </Flex>
                {c.sites.length === 0 ? <Empty>No sites yet. Add one so shifts can be posted for this client.</Empty> : (
                  <div style={{ overflowX: "auto" }}>
                    <Table.Root size="1">
                      <Table.Header><Table.Row>
                        <Table.ColumnHeaderCell>Site</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Location</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Geofence</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Required documents</Table.ColumnHeaderCell>
                        {role !== "coordinator" && <Table.ColumnHeaderCell />}
                      </Table.Row></Table.Header>
                      <Table.Body>
                        {c.sites.map((s) => (
                          <Table.Row key={s.id}>
                            <Table.Cell><Text weight="medium">{s.name}</Text><Text as="div" size="1" color="gray">{s.address}</Text></Table.Cell>
                            <Table.Cell>
                              <a href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}`} target="_blank" rel="noreferrer">
                                <Text size="1">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</Text>
                              </a>
                            </Table.Cell>
                            <Table.Cell>{s.radiusM} m{role === "super_admin" && <Text as="div" size="1" color="gray">PIN {s.sitePin}</Text>}</Table.Cell>
                            <Table.Cell>
                              <Flex gap="1" wrap="wrap">
                                <Badge color="gray" variant="outline">Right to Work</Badge><Badge color="gray" variant="outline">References</Badge>
                                {s.requiredDocs.map((d) => <Badge key={d} color="gray">{d}</Badge>)}
                              </Flex>
                            </Table.Cell>
                            {role !== "coordinator" && <Table.Cell><EditSite site={s} role={role} onSaved={reload} /></Table.Cell>}
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </div>
                )}
              </Card>
            ))}
          </Flex>
        )}
      </Load>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label>
      <Text as="div" size="2" weight="medium" mb="1">{label}</Text>
      {children}
      {hint && <Text size="1" color="gray">{hint}</Text>}
    </label>
  );
}

function AddClient({ onSaved }: { onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const empty = { name: "", sector: "care" as Client["sector"], contact: "", email: "" };
  const [f, setF] = useState(empty);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/clients", "POST", f);
      setOpen(false);
      setF(empty);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
      <Dialog.Trigger><Button><PlusIcon /> Add client</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>Add client</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">Standard rate cards for the sector are created automatically. Edit them under Timesheets → Rate cards.</Dialog.Description>
        <ErrorCallout error={error} />
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <Field label="Client name"><TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Sector">
              <Select.Root value={f.sector} onValueChange={(sector) => setF({ ...f, sector: sector as Client["sector"] })}>
                <Select.Trigger style={{ width: "100%" }} />
                <Select.Content><Select.Item value="care">Care</Select.Item><Select.Item value="hospitality">Hospitality</Select.Item></Select.Content>
              </Select.Root>
            </Field>
            <Field label="Main contact"><TextField.Root value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
            <Field label="Contact email"><TextField.Root type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.name.trim() || !f.contact.trim() || !f.email}>Add client</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function AddSite({ client, onSaved }: { client: Client; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const empty = { name: "", address: "", lat: "", lng: "", radiusM: "150" };
  const [f, setF] = useState(empty);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/sites", "POST", { clientId: client.id, name: f.name, address: f.address, lat: Number(f.lat), lng: Number(f.lng), radiusM: Number(f.radiusM) });
      setOpen(false);
      setF(empty);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
      <Dialog.Trigger><Button size="1" variant="soft"><PlusIcon /> Add site</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Add site to {client.name}</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <Field label="Site name"><TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Address"><TextField.Root value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <Flex gap="3">
              <div style={{ flex: 1 }}><Field label="Latitude"><TextField.Root inputMode="decimal" placeholder="53.8008" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} /></Field></div>
              <div style={{ flex: 1 }}><Field label="Longitude"><TextField.Root inputMode="decimal" placeholder="-1.5491" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} /></Field></div>
            </Flex>
            <Text size="1" color="gray">Tip: right-click the entrance in Google Maps to copy its coordinates.</Text>
            <Field label="Geofence radius (m)" hint="50–500 m. 100–150 m suits most care homes.">
              <TextField.Root type="number" min={50} max={500} value={f.radiusM} onChange={(e) => setF({ ...f, radiusM: e.target.value })} />
            </Field>
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.name.trim() || !f.address.trim() || !f.lat || !f.lng}>Add site</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/** Super Admin edits everything; Client Admin edits only the required documents for their sites. */
function EditSite({ site, role, onSaved }: { site: Site; role: Role; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const init = () => ({ radius: String(site.radiusM), pin: site.sitePin, docs: site.requiredDocs });
  const [f, setF] = useState(init);
  const [error, setError] = useState<ApiError>();
  const admin = role === "super_admin";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send(`/sites/${site.id}`, "PATCH", admin ? { radiusM: Number(f.radius), sitePin: f.pin, requiredDocs: f.docs } : { requiredDocs: f.docs });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }
  const toggle = (d: DocType, on: boolean) => setF({ ...f, docs: on ? [...f.docs, d] : f.docs.filter((x) => x !== d) });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setF(init()); }}>
      <Dialog.Trigger><Button size="1" variant="soft">Edit</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="400px">
        <Dialog.Title>{site.name}</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            {admin && <>
              <Field label="Geofence radius (m)" hint="50–500 m. 100–150 m suits most care homes.">
                <TextField.Root type="number" min={50} max={500} value={f.radius} onChange={(e) => setF({ ...f, radius: e.target.value })} />
              </Field>
              <Field label="Site PIN"><TextField.Root inputMode="numeric" maxLength={4} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} /></Field>
            </>}
            <div>
              <Text as="div" size="2" weight="medium" mb="1">Required documents</Text>
              <Text as="p" size="1" color="gray" mb="2">Right to Work and References are always required. Workers missing any ticked document can't be booked here.</Text>
              <Flex direction="column" gap="1">
                {SITE_DOCS.map((d) => (
                  <Text as="label" size="2" key={d}>
                    <Flex gap="2" align="center"><Checkbox checked={f.docs.includes(d)} onCheckedChange={(v) => toggle(d, v === true)} /> {d}</Flex>
                  </Text>
                ))}
              </Flex>
            </div>
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit">Save</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
