"use client";
import { Card, Flex, Grid, Heading, Table, Text } from "@radix-ui/themes";
import { fmtHours, fmtMoney, useApi } from "@/lib/client";
import { Load, PageHeader } from "@/components/ui";

interface Report {
  fillRate: number; noShowRate: number; shiftsLast14: number; wtrMax: number;
  bySite: { site: string; total: number; filled: number; fillRate: number; noShows: number }[];
  hours: { id: string; name: string; hours: number }[];
  compliance: Record<"compliant" | "expiring" | "pending" | "blocked", number> | null;
  margin: { client: string; hours: number; revenue: number; cost: number; margin: number; marginPct: number }[] | null;
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
