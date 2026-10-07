"use client";
import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, Flex, SegmentedControl, Select, Text, TextArea, TextField } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import { ApiError, addDays, ukDate, useApi, useSend } from "@/lib/client";
import { ErrorCallout } from "@/components/ui";
import { SearchSelect } from "@/components/SearchSelect";
import type { Client, Site, Skill } from "@/lib/types";

export const SKILLS: Record<Client["sector"], Skill[]> = {
  care: ["Carer", "Senior Carer", "Nurse"],
  hospitality: ["Kitchen Porter", "Waiting Staff", "Housekeeping", "Chef"],
};
// Common shift patterns; "custom" keeps whatever times are typed.
const PRESETS: Record<string, [string, string]> = { early: ["07:00", "15:00"], late: ["14:00", "22:00"], long: ["08:00", "20:00"], night: ["21:00", "07:00"] };

/**
 * Post a shift. Used from the Shifts page (own trigger button) and from the Rota, which opens it
 * pre-filled for a site and day via `open` / `defaults`.
 */
export function NewShiftDialog({ onCreated, open: openProp, onOpenChange, defaults, trigger = true }: {
  onCreated: () => void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  defaults?: { siteId?: string; date?: string };
  trigger?: boolean;
}) {
  const { data: clients } = useApi<(Client & { sites: Site[] })[]>("/clients");
  const send = useSend();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const [error, setError] = useState<ApiError>();
  const today = ukDate(new Date());
  const blank = () => ({ siteId: defaults?.siteId ?? "", role: "", date: defaults?.date ?? addDays(today, 1), startTime: "07:00", endTime: "15:00", urgent: false, notes: "" });
  const [f, setF] = useState(blank);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  // Re-apply the Rota's site/day each time it opens the dialog.
  useEffect(() => { if (open) { setF(blank()); setError(undefined); } }, [open, defaults?.siteId, defaults?.date]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientOf = (siteId: string) => clients?.find((c) => c.sites.some((s) => s.id === siteId));
  const sector = clientOf(f.siteId)?.sector;
  const preset = Object.entries(PRESETS).find(([, [a, b]]) => a === f.startTime && b === f.endTime)?.[0] ?? "custom";
  const overnight = f.endTime <= f.startTime;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/shifts", "POST", { ...f, notes: f.notes.trim() || null });
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {trigger && <Dialog.Trigger><Button><PlusIcon /> Post shift</Button></Dialog.Trigger>}
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Post a shift</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">Times are UK time. Pay and bill rates come from the client's rate card.</Dialog.Description>
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
              <TextField.Root type="date" value={f.date} min={today} onChange={(e) => set({ date: e.target.value })} required />
            </label>
            <div>
              <Text as="div" size="2" weight="medium" mb="1">Shift</Text>
              <SegmentedControl.Root size="1" value={preset} onValueChange={(p) => { if (PRESETS[p]) set({ startTime: PRESETS[p][0], endTime: PRESETS[p][1] }); }}>
                <SegmentedControl.Item value="early">Early 7–3</SegmentedControl.Item>
                <SegmentedControl.Item value="late">Late 2–10</SegmentedControl.Item>
                <SegmentedControl.Item value="long">Long day</SegmentedControl.Item>
                <SegmentedControl.Item value="night">Night</SegmentedControl.Item>
                <SegmentedControl.Item value="custom">Custom</SegmentedControl.Item>
              </SegmentedControl.Root>
            </div>
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
            {overnight && <Text size="1" color="gray">Ends the next morning (overnight shift).</Text>}
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Notes for the worker (optional)</Text>
              <TextArea rows={2} maxLength={1000} placeholder="e.g. Use the side entrance, ask for the unit manager" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
            </label>
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
