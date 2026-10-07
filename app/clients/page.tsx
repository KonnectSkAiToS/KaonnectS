"use client";
import { useState } from "react";
import { Badge, Button, Card, Dialog, Flex, Heading, Table, Text, TextField } from "@radix-ui/themes";
import { ApiError, useApi, useRole, useSend } from "@/lib/client";
import { ErrorCallout, Load, PageHeader } from "@/components/ui";
import type { Client, Site } from "@/lib/types";

export default function ClientsPage() {
  const { role } = useRole();
  const { data, error, reload } = useApi<(Client & { sites: Site[] })[]>("/clients");
  return (
    <>
      <PageHeader title="Clients & Sites" subtitle="Each site has a map pin, a geofence radius for check-in, and its own compliance requirements." />
      <Load data={data} error={error}>
        {(clients) => (
          <Flex direction="column" gap="4">
            {clients.map((c) => (
              <Card key={c.id}>
                <Flex justify="between" align="start" mb="3" wrap="wrap" gap="2">
                  <div>
                    <Heading size="4">{c.name}</Heading>
                    <Text size="2" color="gray">{c.contact} · {c.email}</Text>
                  </div>
                  <Badge color={c.sector === "care" ? "violet" : "teal"}>{c.sector}</Badge>
                </Flex>
                <div style={{ overflowX: "auto" }}>
                  <Table.Root size="1">
                    <Table.Header><Table.Row>
                      <Table.ColumnHeaderCell>Site</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Location</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Geofence</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Required documents</Table.ColumnHeaderCell>
                      {role === "super_admin" && <Table.ColumnHeaderCell />}
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
                          <Table.Cell><Flex gap="1" wrap="wrap">{s.requiredDocs.map((d) => <Badge key={d} color="gray">{d}</Badge>)}</Flex></Table.Cell>
                          {role === "super_admin" && <Table.Cell><EditSite site={s} onSaved={reload} /></Table.Cell>}
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </div>
              </Card>
            ))}
          </Flex>
        )}
      </Load>
    </>
  );
}

function EditSite({ site, onSaved }: { site: Site; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [radius, setRadius] = useState(String(site.radiusM));
  const [pin, setPin] = useState(site.sitePin);
  const [error, setError] = useState<ApiError>();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send(`/sites/${site.id}`, "PATCH", { radiusM: Number(radius), sitePin: pin });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
      <Dialog.Trigger><Button size="1" variant="soft">Edit</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="380px">
        <Dialog.Title>{site.name}</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Geofence radius (m)</Text>
              <TextField.Root type="number" min={50} max={500} value={radius} onChange={(e) => setRadius(e.target.value)} />
              <Text size="1" color="gray">50–500 m. 100–150 m suits most care homes.</Text>
            </label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Site PIN</Text>
              <TextField.Root inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} />
            </label>
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
