"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Callout, Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { ChevronLeftIcon, ChevronRightIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtTime, useApi, useRole, useSend } from "@/lib/client";
import { ErrorCallout, Load, PageHeader } from "@/components/ui";
import type { ShiftStatus, ShiftView, Worker } from "@/lib/types";

const CHIP: Record<ShiftStatus, string> = {
  open: "orange", applied: "amber", assigned: "blue", confirmed: "indigo",
  in_progress: "cyan", completed: "green", cancelled: "gray", no_show: "red",
};
const MOVABLE: ShiftStatus[] = ["open", "applied", "assigned", "confirmed"];
const OPEN_ROW = "_open";

function monday(offsetWeeks: number) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function RotaPage() {
  const { role } = useRole();
  const send = useSend();
  const [week, setWeek] = useState(0);
  const [by, setBy] = useState<"site" | "worker">("site");
  const [dropError, setDropError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);
  const from = monday(week);
  const to = monday(week + 1);
  const days = Array.from({ length: 7 }, (_, i) => new Date(from.getTime() + i * 864e5));
  const { data, error, reload } = useApi<ShiftView[]>(`/shifts?from=${from.toISOString()}&to=${to.toISOString()}`);
  const { data: workers } = useApi<Worker[]>(by === "worker" ? "dummy:/workers" : null);
  const today = new Date().toDateString();
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
      <PageHeader title="Rota" subtitle="Week view of every shift. Click a shift to open it.">
        <SegmentedControl.Root value={by} onValueChange={(v) => setBy(v as "site" | "worker")}>
          <SegmentedControl.Item value="site">By site</SegmentedControl.Item>
          <SegmentedControl.Item value="worker">By worker</SegmentedControl.Item>
        </SegmentedControl.Root>
        <Button variant="soft" onClick={() => setWeek(week - 1)} aria-label="Previous week"><ChevronLeftIcon /></Button>
        <Button variant="soft" onClick={() => setWeek(0)}>This week</Button>
        <Button variant="soft" onClick={() => setWeek(week + 1)} aria-label="Next week"><ChevronRightIcon /></Button>
      </PageHeader>
      {canDrag && (
        <Callout.Root size="1" mb="3">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>Drag a future shift onto a worker's row to assign it, or onto <b>Unfilled</b> to release it. The same compliance, double-booking, rest and 48h checks apply.</Callout.Text>
        </Callout.Root>
      )}
      <ErrorCallout error={dropError} />
      <Text as="p" size="2" color="gray" mb="3">{fmtDate(from.toISOString())} – {fmtDate(days[6].toISOString())}{busy && " · saving…"}</Text>
      <Load data={data} error={error}>
        {(shifts) => {
          const visible = shifts.filter((s) => s.status !== "cancelled");
          let rows: [string, string][];
          if (by === "site") {
            rows = [...new Map(visible.map((s) => [s.siteId, s.siteName])).entries()];
          } else {
            // Every worker gets a row so shifts can be dropped on anyone; busiest first.
            const count = (id: string) => visible.filter((s) => s.workerId === id).length;
            rows = [[OPEN_ROW, "Unfilled"], ...(workers ?? [])
              .map((w): [string, string] => [w.id, w.name])
              .sort((a, b) => count(b[0]) - count(a[0]) || a[1].localeCompare(b[1]))];
          }
          const key = (s: ShiftView) => (by === "site" ? s.siteId : s.workerId ?? OPEN_ROW);
          return (
            <div style={{ overflowX: "auto" }}>
              <div className="rota">
                <div className="head" />
                {days.map((d) => <div key={d.toISOString()} className={`head${d.toDateString() === today ? " today" : ""}`}>{fmtDate(d.toISOString())}</div>)}
                {rows.map(([id, name]) => (
                  <Row key={id} id={id} name={name} days={days} today={today} by={by} canDrag={canDrag}
                    shifts={visible.filter((s) => key(s) === id)} all={visible} onDrop={onDrop} />
                ))}
              </div>
              {rows.length === 0 && <Text as="p" color="gray" mt="3">No shifts this week.</Text>}
            </div>
          );
        }}
      </Load>
    </>
  );
}

function Row({ id, name, days, today, shifts, all, by, canDrag, onDrop }: {
  id: string; name: string; days: Date[]; today: string; shifts: ShiftView[]; all: ShiftView[]; by: string;
  canDrag: boolean; onDrop: (s: ShiftView, rowId: string) => void;
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
      {days.map((d) => (
        <div key={d.toISOString()} className={d.toDateString() === today ? "today" : ""} style={highlight} {...dropProps}>
          {shifts.filter((s) => new Date(s.start).toDateString() === d.toDateString()).map((s) => {
            const draggable = canDrag && MOVABLE.includes(s.status) && Date.parse(s.start) > Date.now();
            return (
              <Link key={s.id} href={`/shifts/${s.id}`} className="chip" draggable={draggable}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                style={{ background: `var(--${CHIP[s.status]}-3)`, borderColor: `var(--${CHIP[s.status]}-9)`, color: `var(--${CHIP[s.status]}-12)`, cursor: draggable ? "grab" : undefined }}>
                <strong>{fmtTime(s.start)}–{fmtTime(s.end)}</strong> {s.urgent && "⚑"}<br />
                {s.role}<br />
                {by === "site" ? (s.workerName ?? `Open${s.applicants.length ? ` · ${s.applicants.length} applied` : ""}`) : s.siteName}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
