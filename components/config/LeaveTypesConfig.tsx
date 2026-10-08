"use client";
import { useState } from "react";
import { Badge, Box, Button, Card, Checkbox, Dialog, Flex, Switch, Table, Text, TextField } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import { ApiError, useLeaveTypes, useSend, type LeaveTypeConfig } from "@/lib/client";
import { ErrorCallout, Load } from "@/components/ui";

// Calendar colours an agency can pick from (Radix colour scales).
const COLORS = ["green", "grass", "teal", "cyan", "sky", "blue", "indigo", "iris", "violet", "purple", "plum", "pink", "crimson", "red", "tomato", "orange", "amber", "gold", "brown", "gray"];

/** Configuration → Leave → Leave types. Rules come from the flags here, not from the type's name. */
export function LeaveTypesConfig({ readOnly = false }: { readOnly?: boolean }) {
  const { leaveTypes, error, reload } = useLeaveTypes();
  const [showInactive, setShowInactive] = useState(false);
  return (
    <Flex direction="column" gap="3" mt="2">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text as="label" size="2"><Flex gap="2" align="center"><Switch checked={showInactive} onCheckedChange={setShowInactive} /> Show inactive</Flex></Text>
        {!readOnly && <LeaveTypeDialog count={leaveTypes?.length ?? 0} onSaved={reload} />}
      </Flex>
      <Load data={leaveTypes} error={error}>
        {(rows) => (
          <Card style={{ overflowX: "auto" }}>
            <Table.Root size="1">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Leave type</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Paid</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Uses holiday balance</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Blocks booking</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Requests</Table.ColumnHeaderCell>{!readOnly && <Table.ColumnHeaderCell />}
              </Table.Row></Table.Header>
              <Table.Body>
                {rows.filter((t) => showInactive || t.active).map((t) => (
                  <Table.Row key={t.id} style={{ opacity: t.active ? 1 : 0.55 }}>
                    <Table.Cell><Badge color={t.color as never} variant="solid">{t.name}</Badge> {!t.active && <Badge color="gray">inactive</Badge>}</Table.Cell>
                    <Table.Cell>{t.paid ? "Yes" : <Text color="gray">No</Text>}</Table.Cell>
                    <Table.Cell>{t.countsAgainstHoliday ? "Yes" : <Text color="gray">No</Text>}</Table.Cell>
                    <Table.Cell>{t.blocksBooking ? "Yes" : <Text color="gray">No</Text>}</Table.Cell>
                    <Table.Cell>{t.usage.requests}</Table.Cell>
                    {!readOnly && <Table.Cell><LeaveTypeDialog leaveType={t} count={rows.length} onSaved={reload} /></Table.Cell>}
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

function LeaveTypeDialog({ leaveType, count, onSaved }: { leaveType?: LeaveTypeConfig; count: number; onSaved: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const init = () => ({
    name: leaveType?.name ?? "", color: leaveType?.color ?? "blue", paid: leaveType?.paid ?? false,
    countsAgainstHoliday: leaveType?.countsAgainstHoliday ?? false, blocksBooking: leaveType?.blocksBooking ?? true,
    active: leaveType?.active ?? true, sortOrder: leaveType?.sortOrder ?? count,
  });
  const [f, setF] = useState(init);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (leaveType) await send(`/config/leave-types/${leaveType.id}`, "PATCH", f);
      else await send("/config/leave-types", "POST", f);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); if (o) setF(init()); }}>
      <Dialog.Trigger>{leaveType ? <Button size="1" variant="soft">Edit</Button> : <Button><PlusIcon /> Add leave type</Button>}</Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>{leaveType ? `Edit ${leaveType.name}` : "Add leave type"}</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            <label><Text as="div" size="2" weight="medium" mb="1">Name</Text>
              <TextField.Root value={f.name} maxLength={80} placeholder="e.g. Study leave" onChange={(e) => setF({ ...f, name: e.target.value })} />
              {leaveType && f.name.trim() && f.name.trim() !== leaveType.name && leaveType.usage.requests > 0 && (
                <Text size="1" color="amber">Renaming updates {leaveType.usage.requests} existing requests.</Text>
              )}
            </label>
            <div>
              <Text as="div" size="2" weight="medium" mb="1">Calendar colour</Text>
              <Flex gap="1" wrap="wrap">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={c} title={c} onClick={() => setF({ ...f, color: c })}
                    style={{ width: 24, height: 24, borderRadius: 6, cursor: "pointer", background: `var(--${c}-9)`, border: f.color === c ? "3px solid var(--gray-12)" : "3px solid transparent" }} />
                ))}
              </Flex>
            </div>
            <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.paid} onCheckedChange={(v) => setF({ ...f, paid: v === true })} /> Paid</Flex></Text>
            <Box>
              <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.countsAgainstHoliday} onCheckedChange={(v) => setF({ ...f, countsAgainstHoliday: v === true })} /> Uses the holiday balance</Flex></Text>
              <Text size="1" color="gray">Approval checks the balance; not available to umbrella workers.</Text>
            </Box>
            <Box>
              <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.blocksBooking} onCheckedChange={(v) => setF({ ...f, blocksBooking: v === true })} /> Blocks booking</Flex></Text>
              <Text size="1" color="gray">Approved leave stops the worker being booked, and releases shifts already booked in that period.</Text>
            </Box>
            {leaveType && <Text as="label" size="2"><Flex gap="2" align="center"><Switch checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} /> Active</Flex></Text>}
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.name.trim()}>{leaveType ? "Save" : "Add"}</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
