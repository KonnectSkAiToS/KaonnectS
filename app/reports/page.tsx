"use client";
import Link from "next/link";
import { Badge, Box, Card, Flex, Grid, Heading, Table, Text } from "@radix-ui/themes";
import { fmtDate, fmtHours, fmtMoney, useApi } from "@/lib/client";
import { Load, PageHeader } from "@/components/ui";

interface Report {
  fillRate: number; noShowRate: number; shiftsLast14: number; wtrMax: number;
  bySite: { site: string; total: number; filled: number; fillRate: number; noShows: number }[];
  hours: { id: string; name: string; hours: number }[];
  compliance: Record<"compliant" | "expiring" | "pending" | "blocked", number> | null;
  margin: { client: string; hours: number; revenue: number; cost: number; margin: number; marginPct: number }[] | null;
  reliability: { id: string; name: string; score: number; noShows: number }[];
  wtrRisk: { id: string; name: string; hours: number }[];
  weeklyMargin: { weekEnding: string; hours: number; revenue: number; cost: number; margin: number }[] | null;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <Card><Text as="div" size="2" color="gray">{label}</Text><Text as="div" size="7" weight="bold">{value}</Text></Card>;
}

export default function ReportsPage() {
  const { data, error } = useApi<Report>("/reports");
  return (
    <>
      <PageHeader title="Reports" subtitle="Covers the last 14 days unless stated." />
      <Load data={data} error={error}>
        {(r) => (
          <Flex direction="column" gap="4">
            <Grid columns={{ initial: "1", sm: "3" }} gap="3">
              <Kpi label="Fill rate" value={`${r.fillRate}%`} />
              <Kpi label="No-show rate" value={`${r.noShowRate}%`} />
              <Kpi label="Shifts (14 days)" value={String(r.shiftsLast14)} />
            </Grid>

            <Grid columns={{ initial: "1", md: "2" }} gap="4">
              <Card>
                <Heading size="3" mb="3">By site</Heading>
                <Table.Root size="1">
                  <Table.Header><Table.Row>
                    <Table.ColumnHeaderCell>Site</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Filled</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Fill rate</Table.ColumnHeaderCell><Table.ColumnHeaderCell>No-shows</Table.ColumnHeaderCell>
                  </Table.Row></Table.Header>
                  <Table.Body>
                    {r.bySite.map((s) => (
                      <Table.Row key={s.site}>
                        <Table.Cell>{s.site}</Table.Cell><Table.Cell>{s.filled}/{s.total}</Table.Cell>
                        <Table.Cell>{s.fillRate}%</Table.Cell><Table.Cell>{s.noShows}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>

              <Card>
                <Heading size="3" mb="1">Hours this week</Heading>
                <Text as="p" size="1" color="gray" mb="3">Against the {r.wtrMax}h Working Time Regulations limit.</Text>
                <Flex direction="column" gap="2" style={{ maxHeight: 360, overflowY: "auto" }}>
                  {r.hours.map((w) => (
                    <Flex key={w.id} align="center" gap="3">
                      <Text size="2" style={{ width: 140 }} truncate>{w.name}</Text>
                      <div className="bar" style={{ flex: 1 }}><span style={{ width: `${Math.min(100, (w.hours / r.wtrMax) * 100)}%`, background: w.hours > r.wtrMax * 0.85 ? "var(--red-9)" : undefined }} /></div>
                      <Text size="1" color="gray" style={{ width: 44, textAlign: "right" }}>{fmtHours(w.hours)}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Card>
            </Grid>

            <Grid columns={{ initial: "1", md: "2" }} gap="4">
              <Card>
                <Heading size="3" mb="1">Reliability</Heading>
                <Text as="p" size="1" color="gray" mb="3">Last 60 days: starts at 100, −20 per no-show, −5 per check-in more than 10 minutes late.</Text>
                <Table.Root size="1">
                  <Table.Header><Table.Row>
                    <Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell><Table.ColumnHeaderCell>No-shows</Table.ColumnHeaderCell>
                  </Table.Row></Table.Header>
                  <Table.Body>
                    {[...r.reliability.slice(0, 5), ...r.reliability.slice(-5).filter((w) => !r.reliability.slice(0, 5).includes(w))].map((w, i) => (
                      <Table.Row key={w.id} style={i === 5 ? { borderTop: "2px solid var(--gray-a6)" } : undefined}>
                        <Table.Cell><Link href={`/workers/${w.id}`}>{w.name}</Link></Table.Cell>
                        <Table.Cell><Badge color={w.score >= 85 ? "green" : w.score >= 65 ? "amber" : "red"}>{w.score}</Badge></Table.Cell>
                        <Table.Cell>{w.noShows}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
                <Text as="p" size="1" color="gray" mt="2">Top 5 and bottom 5 shown.</Text>
              </Card>

              <Card>
                <Heading size="3" mb="1">Working Time Regulations risk</Heading>
                <Text as="p" size="1" color="gray" mb="3">Workers at 80% or more of the {r.wtrMax}h weekly limit this week.</Text>
                {r.wtrRisk.length === 0 ? <Text size="2" color="gray">Nobody is close to the limit.</Text> : (
                  <Table.Root size="1">
                    <Table.Body>
                      {r.wtrRisk.map((w) => (
                        <Table.Row key={w.id}>
                          <Table.Cell><Link href={`/workers/${w.id}`}>{w.name}</Link></Table.Cell>
                          <Table.Cell><Badge color={w.hours >= r.wtrMax ? "red" : "amber"}>{fmtHours(w.hours)}</Badge></Table.Cell>
                          <Table.Cell><Text size="1" color="gray">{fmtHours(Math.max(0, r.wtrMax - w.hours))} left</Text></Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Card>
            </Grid>

            {r.weeklyMargin && (
              <Card>
                <Heading size="3" mb="3">Weekly revenue vs pay-out (last 4 weeks)</Heading>
                {(() => {
                  const max = Math.max(1, ...r.weeklyMargin.map((w) => w.revenue));
                  return (
                    <Flex direction="column" gap="3">
                      {r.weeklyMargin.map((w) => (
                        <Flex key={w.weekEnding} align="center" gap="3">
                          <Text size="2" style={{ width: 110 }}>w/e {fmtDate(w.weekEnding)}</Text>
                          <Box flexGrow="1">
                            <div className="bar" style={{ height: 10 }}><span style={{ width: `${(w.revenue / max) * 100}%` }} /></div>
                            <div className="bar" style={{ height: 10, marginTop: 3 }}><span style={{ width: `${(w.cost / max) * 100}%`, background: "var(--gray-9)" }} /></div>
                          </Box>
                          <Text size="1" style={{ width: 170, textAlign: "right" }}>{fmtMoney(w.revenue)} / {fmtMoney(w.cost)}<Text as="div" color="green">margin {fmtMoney(w.margin)}</Text></Text>
                        </Flex>
                      ))}
                      <Flex gap="3"><Badge>revenue (bill)</Badge><Badge color="gray">pay-out</Badge></Flex>
                    </Flex>
                  );
                })()}
              </Card>
            )}

            {r.compliance && (
              <Card>
                <Heading size="3" mb="3">Workforce compliance</Heading>
                <Grid columns={{ initial: "2", sm: "4" }} gap="3">
                  {Object.entries(r.compliance).map(([k, v]) => <Kpi key={k} label={k} value={String(v)} />)}
                </Grid>
              </Card>
            )}

            {r.margin && (
              <Card>
                <Heading size="3" mb="3">Revenue vs pay-out by client</Heading>
                <Table.Root size="1">
                  <Table.Header><Table.Row>
                    <Table.ColumnHeaderCell>Client</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Hours</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Revenue</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Pay-out</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Margin</Table.ColumnHeaderCell>
                  </Table.Row></Table.Header>
                  <Table.Body>
                    {r.margin.map((m) => (
                      <Table.Row key={m.client}>
                        <Table.Cell>{m.client}</Table.Cell><Table.Cell>{fmtHours(m.hours)}</Table.Cell>
                        <Table.Cell>{fmtMoney(m.revenue)}</Table.Cell><Table.Cell>{fmtMoney(m.cost)}</Table.Cell>
                        <Table.Cell>{fmtMoney(m.margin)} <Text color="gray">({m.marginPct}%)</Text></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>
            )}
          </Flex>
        )}
      </Load>
    </>
  );
}
