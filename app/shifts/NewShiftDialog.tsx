"use client";
import { useState } from "react";
import { Button, Checkbox, Dialog, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import { SearchSelect } from "@/components/SearchSelect";
import { ApiError, useApi, useSend } from "@/lib/client";
import { ErrorCallout } from "@/components/ui";
import type { Client, Site, Skill } from "@/lib/types";

const SKILLS: Record<Client["sector"], Skill[]> = {
  care: ["Carer", "Senior Carer", "Nurse"],
  hospitality: ["Kitchen Porter", "Waiting Staff", "Housekeeping", "Chef"],
};

export function NewShiftDialog({ onCreated }: { onCreated: () => void }) {
  const { data: clients } = useApi<(Client & { sites: Site[] })[]>("dummy:/clients");
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const [f, setF] = useState({ siteId: "", role: "", date: tomorrow, startTime: "08:00", endTime: "16:00", urgent: false });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const sites = clients?.flatMap((c) => c.sites.map((s) => ({ ...s, sector: c.sector }))) ?? [];
  const sector = sites.find((s) => s.id === f.siteId)?.sector;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/shifts", "POST", f);
      setOpen(false);
      setError(undefined);
      onCreated();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> Post shift</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Post a shift</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">Pay and bill rates are taken from the client's rate card.</Dialog.Description>
        <ErrorCallout error={error} />
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Site</Text>
              <SearchSelect noun="site" placeholder="Choose site" value={f.siteId} onChange={(siteId) => set({ siteId, role: "" })}
                options={clients?.flatMap((c) => c.sites.map((s) => ({ id: s.id, label: s.name, hint: c.name }))) ?? []} />
            </label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Role</Text>
              <Select.Root value={f.role} onValueChange={(role) => set({ role })} disabled={!sector}>
                <Select.Trigger placeholder={sector ? "Choose role" : "Choose a site first"} style={{ width: "100%" }} />
                <Select.Content>{(sector ? SKILLS[sector] : []).map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}</Select.Content>
              </Select.Root>
            </label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Date</Text>
              <TextField.Root type="date" value={f.date} min={tomorrow} onChange={(e) => set({ date: e.target.value })} required />
            </label>
            <Flex gap="3">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" weight="medium" mb="1">Start</Text>
                <TextField.Root type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} required />
              </label>
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" weight="medium" mb="1">End</Text>
                <TextField.Root type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} required />
              </label>
            </Flex>
            <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.urgent} onCheckedChange={(v) => set({ urgent: v === true })} /> Mark as urgent</Flex></Text>
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button variant="soft" color="gray" type="button">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.siteId || !f.role}>Post shift</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
