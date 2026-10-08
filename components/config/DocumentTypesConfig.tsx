"use client";
import { useState } from "react";
import { Badge, Button, Card, Checkbox, Dialog, Flex, Switch, Table, Text, TextArea, TextField } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import { ApiError, useDocumentTypes, useSend, type DocumentTypeConfig } from "@/lib/client";
import { ErrorCallout, Load } from "@/components/ui";

/** Configuration → Workforce → Document types. */
export function DocumentTypesConfig({ readOnly = false }: { readOnly?: boolean }) {
  const { docTypes, error, reload } = useDocumentTypes();
  const [showInactive, setShowInactive] = useState(false);
  return (
    <Flex direction="column" gap="3" mt="2">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text as="label" size="2"><Flex gap="2" align="center"><Switch checked={showInactive} onCheckedChange={setShowInactive} /> Show inactive</Flex></Text>
        {!readOnly && <DocTypeDialog onSaved={reload} />}
      </Flex>
      <Load data={docTypes} error={error}>
        {(rows) => (
          <Card style={{ overflowX: "auto" }}>
            <Table.Root size="1">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Document</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Who needs it</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Expires</Table.ColumnHeaderCell><Table.ColumnHeaderCell>In use</Table.ColumnHeaderCell>{!readOnly && <Table.ColumnHeaderCell />}
              </Table.Row></Table.Header>
              <Table.Body>
                {rows.filter((d) => showInactive || d.active).map((d) => (
                  <Table.Row key={d.id} style={{ opacity: d.active ? 1 : 0.55 }}>
                    <Table.Cell>
                      <Text weight="medium">{d.name}</Text> {!d.active && <Badge color="gray">inactive</Badge>}
                      {d.description && <Text as="div" size="1" color="gray">{d.description}</Text>}
                    </Table.Cell>
                    <Table.Cell>{d.requiredForAll ? <Badge color="indigo">Every worker</Badge> : <Text size="1" color="gray">Roles / sites that list it</Text>}</Table.Cell>
                    <Table.Cell>{d.hasExpiry ? "Yes" : <Text color="gray">No expiry</Text>}</Table.Cell>
                    <Table.Cell><Text size="1">{d.usage.roles} roles · {d.usage.sites} sites · {d.usage.documents} uploaded</Text></Table.Cell>
                    {!readOnly && <Table.Cell><DocTypeDialog docType={d} onSaved={reload} /></Table.Cell>}
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

function DocTypeDialog({ docType, onSaved }: { docType?: DocumentTypeConfig; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const init = () => ({ name: docType?.name ?? "", description: docType?.description ?? "", hasExpiry: docType?.hasExpiry ?? true, requiredForAll: docType?.requiredForAll ?? false, active: docType?.active ?? true });
  const [f, setF] = useState(init);
  const used = docType ? docType.usage.roles + docType.usage.sites + docType.usage.documents : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = { ...f, description: f.description.trim() || null };
      if (docType) await send(`/config/document-types/${docType.id}`, "PATCH", body);
      else await send("/config/document-types", "POST", body);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setF(init()); }}>
      <Dialog.Trigger>{docType ? <Button size="1" variant="soft">Edit</Button> : <Button><PlusIcon /> Add document type</Button>}</Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>{docType ? `Edit ${docType.name}` : "Add document type"}</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            <label><Text as="div" size="2" weight="medium" mb="1">Name</Text>
              <TextField.Root value={f.name} maxLength={80} placeholder="e.g. First Aid at Work" onChange={(e) => setF({ ...f, name: e.target.value })} />
              {docType && f.name.trim() && f.name.trim() !== docType.name && used > 0 && (
                <Text size="1" color="amber">Renaming updates {docType.usage.roles} roles, {docType.usage.sites} sites and {docType.usage.documents} uploaded documents.</Text>
              )}
            </label>
            <label><Text as="div" size="2" weight="medium" mb="1">Description (optional)</Text>
              <TextArea rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </label>
            <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.hasExpiry} onCheckedChange={(v) => setF({ ...f, hasExpiry: v === true })} /> Has an expiry date (uploads must give one)</Flex></Text>
            <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.requiredForAll} onCheckedChange={(v) => setF({ ...f, requiredForAll: v === true })} /> Every worker needs it, whatever their role</Flex></Text>
            {docType && (
              <Text as="label" size="2"><Flex gap="2" align="center"><Switch checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} /> Active</Flex>
                {!f.active && <Text as="div" size="1" color="gray">Inactive types can't be added to roles, sites or new uploads. Existing documents are kept.</Text>}
              </Text>
            )}
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.name.trim()}>{docType ? "Save" : "Add"}</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
