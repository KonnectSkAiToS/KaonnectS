"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Card, Flex, Select, Table, Text, TextField } from "@radix-ui/themes";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { fmtHours, useApi } from "@/lib/client";
import { ComplianceBadge, Empty, Load, PageHeader } from "@/components/ui";
import { Pager, SortHeader, useTable } from "@/components/table";
import { WTR_MAX_HOURS } from "@/lib/rules";
import type { ComplianceStatus, Worker } from "@/lib/types";

type W = Worker & { compliance: ComplianceStatus; weekHours: number };

export default function WorkersPage() {
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
          return rows.length === 0 ? <Empty>No workers match.</Empty> : <WorkersTable rows={rows} />;
        }}
      </Load>
    </>
  );
}

const COMPLIANCE_ORDER = { blocked: 0, pending: 1, expiring: 2, compliant: 3 };

function WorkersTable({ rows }: { rows: W[] }) {
  const router = useRouter();
  const t = useTable(rows, {
    name: (w) => w.name,
    contract: (w) => w.contractType,
    compliance: (w) => COMPLIANCE_ORDER[w.compliance],
    hours: (w) => w.weekHours,
    reliability: (w) => w.reliability,
  }, { key: "name" });
  return (
    <Card style={{ overflowX: "auto" }}>
      <Table.Root size="1">
        <Table.Header><Table.Row>
          <SortHeader label="Name" k="name" t={t} /><Table.ColumnHeaderCell>Skills</Table.ColumnHeaderCell>
          <SortHeader label="Contract" k="contract" t={t} /><SortHeader label="Compliance" k="compliance" t={t} />
          <SortHeader label="Hours this week" k="hours" t={t} /><SortHeader label="Reliability" k="reliability" t={t} />
        </Table.Row></Table.Header>
        <Table.Body>
          {t.rows.map((w) => (
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
      <Pager {...t.pager} />
    </Card>
  );
}
