"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Card, Flex, Select, Table, Text, TextField } from "@radix-ui/themes";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { fmtHours, useApi } from "@/lib/client";
import { ComplianceBadge, Empty, Load, PageHeader } from "@/components/ui";
import { WTR_MAX_HOURS } from "@/lib/rules";
import type { ComplianceStatus, Worker } from "@/lib/types";

type W = Worker & { compliance: ComplianceStatus; weekHours: number };

export default function WorkersPage() {
  const router = useRouter();
  const { data, error } = useApi<W[]>("/workers");
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("all");
  const [status, setStatus] = useState("all");
  const skills = [...new Set(data?.flatMap((w) => w.skills))].sort();

  return (
    <>
      <PageHeader title="Workers" subtitle="Profiles, skills, compliance status and hours worked this week." />
      <Flex gap="3" mb="4" wrap="wrap">
        <TextField.Root placeholder="Search name or postcode" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }}>
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
        </TextField.Root>
        <Select.Root value={skill} onValueChange={setSkill}>
          <Select.Trigger />
          <Select.Content><Select.Item value="all">All skills</Select.Item>{skills.map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}</Select.Content>
        </Select.Root>
        <Select.Root value={status} onValueChange={setStatus}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Any compliance</Select.Item>
            {["compliant", "expiring", "pending", "blocked"].map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      </Flex>
      <Load data={data} error={error}>
        {(workers) => {
          const rows = workers.filter((w) =>
            (w.name + " " + w.postcode).toLowerCase().includes(q.toLowerCase()) &&
            (skill === "all" || w.skills.includes(skill as Worker["skills"][number])) &&
            (status === "all" || w.compliance === status));
          return rows.length === 0 ? <Empty>No workers match.</Empty> : (
            <Card style={{ overflowX: "auto" }}>
              <Table.Root size="1">
                <Table.Header><Table.Row>
                  <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Skills</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Contract</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Compliance</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Hours this week</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Reliability</Table.ColumnHeaderCell>
                </Table.Row></Table.Header>
                <Table.Body>
                  {rows.map((w) => (
                    <Table.Row key={w.id} className="rowlink" onClick={() => router.push(`/workers/${w.id}`)}>
                      <Table.Cell><Text weight="medium">{w.name}</Text><Text as="div" size="1" color="gray">{w.postcode}</Text></Table.Cell>
                      <Table.Cell><Flex gap="1" wrap="wrap">{w.skills.map((s) => <Badge key={s} color="gray">{s}</Badge>)}</Flex></Table.Cell>
                      <Table.Cell>{w.contractType}</Table.Cell>
                      <Table.Cell><ComplianceBadge status={w.compliance} /></Table.Cell>
                      <Table.Cell><Text color={w.weekHours > WTR_MAX_HOURS * 0.85 ? "red" : undefined}>{fmtHours(w.weekHours)}</Text> <Text size="1" color="gray">/ {WTR_MAX_HOURS}h</Text></Table.Cell>
                      <Table.Cell>{w.reliability}%</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Card>
          );
        }}
      </Load>
    </>
  );
}
