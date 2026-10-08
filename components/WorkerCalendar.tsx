"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Box, Button, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { addDays, fmtHours, fmtTime, ukDate, useApi, useLeaveTypes } from "@/lib/client";
import { Load } from "@/components/ui";

interface CalShift { id: string; role: string; start: string; end: string; status: string; siteName: string; hours: number }
interface CalLeave { id: string; type: string; from: string; to: string; status: "pending" | "approved"; note: string | null }
interface Calendar { month: string; shifts: CalShift[]; leave: CalLeave[] }

// How a shift reads on the calendar.
const KIND = (status: string) =>
  ["completed", "in_progress"].includes(status) ? { label: "Worked", color: "green" }
  : status === "no_show" ? { label: "No-show", color: "red" }
  : { label: "Scheduled", color: "blue" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const shiftMonth = (month: string, n: number) => {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

/** Month view of a worker's shifts (worked, scheduled, no-show) and leave. UK dates. */
export function WorkerCalendar({ workerId }: { workerId: string }) {
  const today = ukDate(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const { data, error } = useApi<Calendar>(`/workers/${workerId}/calendar?month=${month}`);
  const { color: leaveColor } = useLeaveTypes();

  // Grid: Monday-first weeks covering the whole month.
  const first = `${month}-01`;
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = addDays(first, i - lead);
    return { day, inMonth: day.startsWith(month) };
  });

  return (
    <Card>
      <Flex justify="between" align="center" mb="3" gap="3" wrap="wrap">
        <Heading size="3">Calendar</Heading>
        <Flex align="center" gap="2">
          <Button size="1" variant="soft" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeftIcon /></Button>
          <Text size="2" weight="medium" style={{ minWidth: 130, textAlign: "center" }}>{monthLabel(month)}</Text>
          <Button size="1" variant="soft" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRightIcon /></Button>
          {month !== today.slice(0, 7) && <Button size="1" variant="ghost" onClick={() => setMonth(today.slice(0, 7))}>Today</Button>}
        </Flex>
      </Flex>
      <Load data={data} error={error}>
        {({ shifts, leave }) => {
          const byDay = Map.groupBy(shifts, (s) => ukDate(s.start));
          const leaveOn = (day: string) => leave.filter((l) => l.from <= day && l.to >= day);
          const worked = shifts.filter((s) => ["completed", "in_progress"].includes(s.status));
          const scheduled = shifts.filter((s) => ["assigned", "confirmed", "open", "applied"].includes(s.status));
          const leaveDays = cells.filter((c) => c.inMonth && leaveOn(c.day).some((l) => l.status === "approved")).length;

          return (
            <>
              <Grid columns={{ initial: "2", sm: "4" }} gap="2" mb="3">
                <Stat label="Worked" value={`${fmtHours(worked.reduce((a, s) => a + s.hours, 0))} · ${worked.length} shifts`} />
                <Stat label="Scheduled" value={`${fmtHours(scheduled.reduce((a, s) => a + s.hours, 0))} · ${scheduled.length} shifts`} />
                <Stat label="No-shows" value={String(shifts.filter((s) => s.status === "no_show").length)} />
                <Stat label="Leave days (approved)" value={String(leaveDays)} />
              </Grid>

              <Box style={{ overflowX: "auto" }}>
                <div className="worker-cal">
                  {WEEKDAYS.map((d) => <div key={d} className="wc-head">{d}</div>)}
                  {cells.map(({ day, inMonth }) => (
                    <div key={day} className={`wc-day${inMonth ? "" : " wc-out"}${day === today ? " wc-today" : ""}`}>
                      <Text size="1" weight={day === today ? "bold" : "regular"} color={inMonth ? undefined : "gray"}>{+day.slice(8)}</Text>
                      {leaveOn(day).map((l) => {
                        const c = leaveColor(l.type);
                        return (
                          <div key={l.id} className="wc-leave" title={`${l.type} (${l.status})${l.note ? ` · ${l.note}` : ""}`}
                            style={{ background: `var(--${c}-${l.status === "approved" ? 9 : 4})`, color: l.status === "approved" ? "white" : `var(--${c}-11)` }}>
                            {l.type}{l.status === "pending" && " ?"}
                          </div>
                        );
                      })}
                      {(byDay.get(day) ?? []).map((s) => {
                        const k = KIND(s.status);
                        return (
                          <Link key={s.id} href={`/shifts/${s.id}`} className="wc-shift" title={`${k.label} · ${s.role} at ${s.siteName}`}
                            style={{ background: `var(--${k.color}-3)`, borderColor: `var(--${k.color}-9)`, color: `var(--${k.color}-12)` }}>
                            {fmtTime(s.start)}–{fmtTime(s.end)}<br /><span className="wc-site">{s.siteName}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </Box>

              <Flex gap="2" mt="3" wrap="wrap" align="center">
                <Badge color="green">Worked</Badge><Badge color="blue">Scheduled</Badge><Badge color="red">No-show</Badge>
                {[...new Set(leave.map((l) => l.type))].map((t) => <Badge key={t} color={leaveColor(t) as never} variant="solid">{t}</Badge>)}
                <Text size="1" color="gray">Solid leave = approved, light = pending. Times are UK time.</Text>
              </Flex>
            </>
          );
        }}
      </Load>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box p="2" style={{ background: "var(--gray-a2)", borderRadius: "var(--radius-2)" }}>
      <Text as="div" size="1" color="gray">{label}</Text>
      <Text as="div" size="2" weight="medium">{value}</Text>
    </Box>
  );
}
