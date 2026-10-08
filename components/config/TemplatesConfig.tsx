"use client";
import { useState } from "react";
import { Badge, Button, Card, Dialog, Flex, Switch, Table, Text, TextArea, TextField } from "@radix-ui/themes";
import { ApiError, useApi, useSend } from "@/lib/client";
import { ErrorCallout, Load } from "@/components/ui";
import type { NotificationTemplate } from "@/lib/types";


const EVENT_LABEL: Record<NotificationTemplate["event"], string> = {
  "shift.matched": "New shift match", "shift.confirmed": "Shift confirmed", "shift.cancelled": "Shift cancelled",
  "shift.reminder": "Reminder 1 hour before shift", "document.expiring": "Document expiring",
  "leave.decided": "Leave approved / rejected", "timesheet.approved": "Timesheet approved",
};
const LIMIT = { push: 178, sms: 160, email: 5000 } as const;

/** Configuration → Notifications: message templates per event and channel. */
export function TemplatesConfig({ readOnly = false }: { readOnly?: boolean }) {
  const send = useSend();
  const { data, error, reload } = useApi<NotificationTemplate[]>("/config/templates");
  const [actionError, setActionError] = useState<ApiError>();

  async function toggle(t: NotificationTemplate, enabled: boolean) {
    try {
      setActionError(undefined);
      await send(`/config/templates/${t.id}`, "PATCH", { enabled });
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
                <Table.ColumnHeaderCell>Message</Table.ColumnHeaderCell><Table.ColumnHeaderCell>On</Table.ColumnHeaderCell>{!readOnly && <Table.ColumnHeaderCell />}
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
                    <Table.Cell><Switch checked={t.enabled} disabled={readOnly} onCheckedChange={(v) => toggle(t, v)} aria-label={`Enable ${EVENT_LABEL[t.event]}`} /></Table.Cell>
                    {!readOnly && <Table.Cell><TemplateDialog t={t} onSaved={reload} /></Table.Cell>}
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
      await send(`/config/templates/${t.id}`, "PATCH", t.channel === "email" ? f : { body: f.body });
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

