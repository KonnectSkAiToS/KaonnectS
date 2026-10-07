"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { fmtDate, fmtTime, useApi } from "@/lib/client";
import { Load, PageHeader } from "@/components/ui";
import type { ShiftStatus, ShiftView } from "@/lib/types";

const CHIP: Record<ShiftStatus, string> = {
  open: "orange", applied: "amber", assigned: "blue", confirmed: "indigo",
  in_progress: "cyan", completed: "green", cancelled: "gray", no_show: "red",
};

function monday(offsetWeeks: number) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function RotaPage() {
  const [week, setWeek] = useState(0);
  const [by, setBy] = useState<"site" | "worker">("site");
  const from = monday(week);
  const to = monday(week + 1);
  const days = Array.from({ length: 7 }, (_, i) => new Date(from.getTime() + i * 864e5));
  const { data, error } = useApi<ShiftView[]>(`/shifts?from=${from.toISOString()}&to=${to.toISOString()}`);
  const today = new Date().toDateString();

  return (
    <>
      <PageHeader title="Rota" subtitle="Week view of every shift. Click a shift to assign or change it.">
        <SegmentedControl.Root value={by} onValueChange={(v) => setBy(v as "site" | "worker")}>
          <SegmentedControl.Item value="site">By site</SegmentedControl.Item>
          <SegmentedControl.Item value="worker">By worker</SegmentedControl.Item>
        </SegmentedControl.Root>
        <Button variant="soft" onClick={() => setWeek(week - 1)} aria-label="Previous week"><ChevronLeftIcon /></Button>
        <Button variant="soft" onClick={() => setWeek(0)}>This week</Button>
        <Button variant="soft" onClick={() => setWeek(week + 1)} aria-label="Next week"><ChevronRightIcon /></Button>
      </PageHeader>
      <Text as="p" size="2" color="gray" mb="3">{fmtDate(from.toISOString())} – {fmtDate(days[6].toISOString())}</Text>
      <Load data={data} error={error}>
        {(shifts) => {
          const visible = shifts.filter((s) => s.status !== "cancelled");
          const rows = by === "site"
            ? [...new Map(visible.map((s) => [s.siteId, s.siteName])).entries()]
            : [...new Map(visible.map((s) => [s.workerId ?? "_open", s.workerName ?? "Unfilled"])).entries()].sort((a, b) => (a[0] === "_open" ? -1 : b[0] === "_open" ? 1 : a[1].localeCompare(b[1])));
          const key = (s: ShiftView) => (by === "site" ? s.siteId : s.workerId ?? "_open");
          return (
            <div style={{ overflowX: "auto" }}>
              <div className="rota">
                <div className="head" />
                {days.map((d) => <div key={d.toISOString()} className={`head${d.toDateString() === today ? " today" : ""}`}>{fmtDate(d.toISOString())}</div>)}
                {rows.map(([id, name]) => (
                  <Row key={id} name={name} days={days} today={today} shifts={visible.filter((s) => key(s) === id)} by={by} />
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

function Row({ name, days, today, shifts, by }: { name: string; days: Date[]; today: string; shifts: ShiftView[]; by: string }) {
  return (
    <>
      <div className="head" style={{ background: "var(--gray-2)" }}>{name}</div>
      {days.map((d) => (
        <div key={d.toISOString()} className={d.toDateString() === today ? "today" : ""}>
          {shifts.filter((s) => new Date(s.start).toDateString() === d.toDateString()).map((s) => (
            <Link key={s.id} href={`/shifts/${s.id}`} className="chip" style={{ background: `var(--${CHIP[s.status]}-3)`, borderColor: `var(--${CHIP[s.status]}-9)`, color: `var(--${CHIP[s.status]}-12)` }}>
              <strong>{fmtTime(s.start)}–{fmtTime(s.end)}</strong> {s.urgent && "⚑"}<br />
              {s.role}<br />
              {by === "site" ? (s.workerName ?? `Open${s.applicants.length ? ` · ${s.applicants.length} applied` : ""}`) : s.siteName}
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}
