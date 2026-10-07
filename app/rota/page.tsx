"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Box, Button, Callout, Dialog, Flex, IconButton, SegmentedControl, Switch, Text, VisuallyHidden } from "@radix-ui/themes";
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, Cross2Icon, ExternalLinkIcon, InfoCircledIcon, PlusIcon } from "@radix-ui/react-icons";
import { ApiError, addDays, fmtDate, fmtTime, mondayOf, ukDate, ukMidnight, useApi, useRole, useSend } from "@/lib/client";
import { ErrorCallout, Load, PageHeader } from "@/components/ui";
import { ShiftManager } from "@/components/ShiftManager";
import { NewShiftDialog } from "@/app/shifts/NewShiftDialog";
import type { Client, ShiftStatus, ShiftView, Site, Worker } from "@/lib/types";

const CHIP: Record<ShiftStatus, string> = {
  open: "orange", applied: "amber", assigned: "blue", confirmed: "indigo",
  in_progress: "cyan", completed: "green", cancelled: "gray", no_show: "red",
};
const MOVABLE: ShiftStatus[] = ["open", "applied", "assigned", "confirmed"];
const UNFILLED: ShiftStatus[] = ["open", "applied"];
const OPEN_ROW = "_open";

export default function RotaPage() {
  const { role } = useRole();
  const send = useSend();
  const today = ukDate(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [by, setBy] = useState<"site" | "worker">("site");
  const [unfilledOnly, setUnfilledOnly] = useState(false);
  const [panel, setPanel] = useState<string | null>(null); // shift id in the side panel
  const [create, setCreate] = useState<{ siteId: string; date: string } | null>(null);
  const [dropError, setDropError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const { data, error, reload } = useApi<ShiftView[]>(`/shifts?from=${ukMidnight(weekStart)}&to=${ukMidnight(addDays(weekStart, 7))}`);
  const { data: clients } = useApi<(Client & { sites: Site[] })[]>(by === "site" ? "/clients" : null);
  const { data: workers } = useApi<Worker[]>(by === "worker" ? "/workers" : null);
  const canDrag = by === "worker" && role !== "client_admin";

  async function onDrop(shift: ShiftView, rowId: string) {
    if (rowId === (shift.workerId ?? OPEN_ROW)) return;
    setBusy(true);
    setDropError(undefined);
    try {
      if (rowId === OPEN_ROW) await send(`/shifts/${shift.id}`, "PATCH", { action: "unassign" });
      else await send(`/shifts/${shift.id}/assign`, "POST", { workerId: rowId });
    } catch (e) {
      setDropError(e as ApiError);
    }
    setBusy(false);
    reload();
  }

  return (
    <>
      <PageHeader title="Rota" subtitle="Plan the week. Click a shift to manage it, or + on an empty day to post one. Times are UK time.">
        <SegmentedControl.Root value={by} onValueChange={(v) => setBy(v as "site" | "worker")}>
          <SegmentedControl.Item value="site">By site</SegmentedControl.Item>
          <SegmentedControl.Item value="worker">By worker</SegmentedControl.Item>
        </SegmentedControl.Root>
        <Button variant="soft" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><ChevronLeftIcon /></Button>
        <Button variant="soft" onClick={() => setWeekStart(mondayOf(today))}>This week</Button>
        <Button variant="soft" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><ChevronRightIcon /></Button>
        <CopyLastWeek weekStart={weekStart} onDone={reload} />
      </PageHeader>

      <Flex justify="between" align="center" mb="3" gap="3" wrap="wrap">
        <Text size="2" color="gray">{fmtDate(weekStart)} – {fmtDate(days[6])}{busy && " · saving…"}</Text>
        <Text as="label" size="2"><Flex gap="2" align="center"><Switch checked={unfilledOnly} onCheckedChange={setUnfilledOnly} /> Unfilled only</Flex></Text>
      </Flex>
      {canDrag && (
        <Callout.Root size="1" mb="3">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>Drag an upcoming shift onto a worker to assign it, or onto <b>Unfilled</b> to release it. Compliance, double-booking, rest and the 48h limit are checked.</Callout.Text>
        </Callout.Root>
      )}
      <ErrorCallout error={dropError} />

      <Load data={data} error={error}>
        {(shifts) => {
          const live = shifts.filter((s) => s.status !== "cancelled");
          const visible = unfilledOnly ? live.filter((s) => UNFILLED.includes(s.status)) : live;
          const openByDay = new Map(days.map((d) => [d, live.filter((s) => ukDate(s.start) === d && UNFILLED.includes(s.status)).length]));

          let rows: { id: string; name: string; siteId?: string }[];
          if (by === "site") {
            // Every site appears, even with no shifts, so a day can be filled with "+".
            const all = clients?.flatMap((c) => c.sites.map((s) => ({ id: s.id, name: s.name, siteId: s.id }))) ?? [];
            const fromShifts = [...new Map(visible.map((s) => [s.siteId, s.siteName])).entries()].map(([id, name]) => ({ id, name, siteId: id }));
            rows = all.length ? all : fromShifts;
          } else {
            const count = (id: string) => visible.filter((s) => s.workerId === id).length;
            rows = [{ id: OPEN_ROW, name: "Unfilled" }, ...(workers ?? [])
              .map((w) => ({ id: w.id, name: w.name }))
              .filter((w) => !unfilledOnly || count(w.id))
              .sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name))];
          }
          const key = (s: ShiftView) => (by === "site" ? s.siteId : s.workerId ?? OPEN_ROW);

          return (
            <div style={{ overflowX: "auto" }}>
              <div className="rota">
                <div className="head" />
                {days.map((d) => (
                  <div key={d} className={`head${d === today ? " today" : ""}`}>
                    <Flex justify="between" align="center" gap="1">
                      {fmtDate(d)}
                      {openByDay.get(d)! > 0 && <Badge size="1" color="orange" title="Unfilled shifts">{openByDay.get(d)} open</Badge>}
                    </Flex>
                  </div>
                ))}
                {rows.map((r) => (
                  <Row key={r.id} id={r.id} name={r.name} days={days} today={today} by={by} canDrag={canDrag}
                    shifts={visible.filter((s) => key(s) === r.id)} all={visible} onDrop={onDrop} onOpen={setPanel}
                    onAdd={r.siteId ? (date) => setCreate({ siteId: r.siteId!, date }) : undefined} />
                ))}
              </div>
              {rows.length === 0 && <Text as="p" color="gray" mt="3">Nothing to show this week.</Text>}
            </div>
          );
        }}
      </Load>

      <NewShiftDialog trigger={false} open={!!create} onOpenChange={(o) => !o && setCreate(null)} defaults={create ?? undefined} onCreated={reload} />

      {/* Side panel: manage a shift without leaving the rota. */}
      <Dialog.Root open={!!panel} onOpenChange={(o) => !o && setPanel(null)}>
        <Dialog.Content className="sheet" aria-describedby={undefined}>
          <VisuallyHidden><Dialog.Title>Shift</Dialog.Title></VisuallyHidden>
          <Flex justify="end" gap="2" mb="2">
            {panel && <Link href={`/shifts/${panel}`}><Button size="1" variant="ghost"><ExternalLinkIcon /> Full page</Button></Link>}
            <Dialog.Close><IconButton size="1" variant="ghost" color="gray" aria-label="Close"><Cross2Icon /></IconButton></Dialog.Close>
          </Flex>
          {panel && <ShiftManager id={panel} compact onChanged={reload} />}
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}

function Row({ id, name, days, today, shifts, all, by, canDrag, onDrop, onOpen, onAdd }: {
  id: string; name: string; days: string[]; today: string; shifts: ShiftView[]; all: ShiftView[]; by: string;
  canDrag: boolean; onDrop: (s: ShiftView, rowId: string) => void; onOpen: (id: string) => void; onAdd?: (date: string) => void;
}) {
  const [over, setOver] = useState(false);
  const dropProps = canDrag ? {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const s = all.find((x) => x.id === e.dataTransfer.getData("text/plain"));
      if (s) onDrop(s, id);
    },
  } : {};
  const highlight = over ? { background: "var(--accent-4)" } : undefined;

  return (
    <>
      <div className="head" style={{ background: "var(--gray-2)", ...highlight }} {...dropProps}>{name}</div>
      {days.map((d) => {
        const dayShifts = shifts.filter((s) => ukDate(s.start) === d);
        return (
          <div key={d} className={`cell${d === today ? " today" : ""}`} style={highlight} {...dropProps}>
            {dayShifts.map((s) => {
              const draggable = canDrag && MOVABLE.includes(s.status) && Date.parse(s.start) > Date.now();
              return (
                <button key={s.id} type="button" className="chip" draggable={draggable} onClick={() => onOpen(s.id)}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                  style={{ background: `var(--${CHIP[s.status]}-3)`, borderColor: `var(--${CHIP[s.status]}-9)`, color: `var(--${CHIP[s.status]}-12)`, cursor: draggable ? "grab" : "pointer" }}>
                  <strong>{fmtTime(s.start)}–{fmtTime(s.end)}</strong> {s.urgent && "⚑"}<br />
                  {s.role}<br />
                  {by === "site" ? (s.workerName ?? `Open${s.applicants.length ? ` · ${s.applicants.length} applied` : ""}`) : s.siteName}
                </button>
              );
            })}
            {onAdd && d >= today && (
              <button type="button" className="add-shift" onClick={() => onAdd(d)} aria-label={`Post a shift at ${name} on ${fmtDate(d)}`}>
                <PlusIcon />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Repeat last week's shifts as open shifts in this week, after a preview. */
function CopyLastWeek({ weekStart, onDone }: { weekStart: string; onDone: () => void }) {
  const send = useSend();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ toCreate: number; skippedPast: number; skippedExisting: number }>();
  const [error, setError] = useState<ApiError>();
  const [result, setResult] = useState<string>();

  async function load() {
    setError(undefined); setResult(undefined); setPreview(undefined);
    try { setPreview(await send("/shifts/copy-week", "POST", { targetWeekStart: weekStart, preview: true })); }
    catch (e) { setError(e as ApiError); }
  }
  async function run() {
    try {
      const r = await send<{ created: number }>("/shifts/copy-week", "POST", { targetWeekStart: weekStart, preview: false });
      setResult(`Created ${r.created} open shift${r.created === 1 ? "" : "s"}.`);
      setPreview(undefined);
      onDone();
    } catch (e) { setError(e as ApiError); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <Dialog.Trigger><Button variant="soft"><CopyIcon /> Copy last week</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Copy last week into this week</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Repeats the week before {fmtDate(weekStart)} as open shifts: same sites, roles and times, with current rates. Workers are not copied.
        </Dialog.Description>
        <ErrorCallout error={error} />
        {result && <Callout.Root color="green" mb="3"><Callout.Text>{result}</Callout.Text></Callout.Root>}
        {preview && (
          <Box mb="3">
            <Text as="p" size="3" weight="bold">{preview.toCreate} shift{preview.toCreate === 1 ? "" : "s"} will be created</Text>
            {preview.skippedExisting > 0 && <Text as="p" size="2" color="gray">{preview.skippedExisting} skipped: already on this week's rota</Text>}
            {preview.skippedPast > 0 && <Text as="p" size="2" color="gray">{preview.skippedPast} skipped: would start in the past</Text>}
          </Box>
        )}
        <Flex gap="3" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">{result ? "Close" : "Cancel"}</Button></Dialog.Close>
          {!result && <Button onClick={run} disabled={!preview?.toCreate}>Create {preview?.toCreate ?? ""} shifts</Button>}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
