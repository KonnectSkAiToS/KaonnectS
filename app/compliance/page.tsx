"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Callout, Card, Checkbox, DataList, Dialog, Flex, Select, Table, Tabs, Text, TextField } from "@radix-ui/themes";
import { EyeOpenIcon, FileTextIcon, InfoCircledIcon, PaperPlaneIcon, UploadIcon } from "@radix-ui/react-icons";
import { SearchSelect } from "@/components/SearchSelect";
import { ApiError, fmtDate, fmtDateTime, useApi, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, PageHeader, StatusBadge } from "@/components/ui";
import type { DocType, Worker, WorkerDocument } from "@/lib/types";

type Doc = WorkerDocument & { workerName: string };
const BUCKETS = [
  { key: "expired", label: "Expired", test: (d: number) => d < 0, color: "red" },
  { key: "7", label: "≤ 7 days", test: (d: number) => d >= 0 && d <= 7, color: "orange" },
  { key: "14", label: "≤ 14 days", test: (d: number) => d > 7 && d <= 14, color: "amber" },
  { key: "30", label: "≤ 30 days", test: (d: number) => d > 14 && d <= 30, color: "yellow" },
] as const;
const DOC_TYPES: DocType[] = ["Right to Work", "References", "DBS Enhanced", "Manual Handling", "Safeguarding", "Food Hygiene"];
const day = (s: string) => fmtDate(`${s}T00:00`);

export default function CompliancePage() {
  const send = useSend();
  const { data, error, reload } = useApi<Doc[]>("/documents");
  const [actionError, setActionError] = useState<ApiError>();
  const [notice, setNotice] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function decide(id: string, status: "verified" | "rejected") {
    try {
      setActionError(undefined);
      await send(`/documents/${id}`, "PATCH", { status });
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  async function remind(ids: string[]) {
    try {
      setActionError(undefined);
      const r = await send<{ sent: number; skipped: number }>("/documents/remind", "POST", { documentIds: ids });
      setNotice(`Sent ${r.sent} reminder${r.sent !== 1 ? "s" : ""}.${r.skipped ? ` Skipped ${r.skipped} already reminded in the last 24 hours.` : ""}`);
      setSelected(new Set());
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  return (
    <>
      <PageHeader title="Compliance" subtitle="Verify uploaded documents and track expiries. Workers with expired mandatory documents can't be booked.">
        <UploadDocument onSaved={() => { setNotice("Document uploaded. It's in the verification queue."); reload(); }} />
      </PageHeader>
      <ErrorCallout error={actionError} />
      {notice && <Callout.Root color="green" mb="4"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>{notice}</Callout.Text></Callout.Root>}
      <Load data={data} error={error}>
        {(docs) => {
          const pending = docs.filter((d) => d.status === "pending");
          const withDays = docs
            .filter((d) => d.expiresOn && d.status !== "rejected")
            .map((d) => ({ ...d, days: Math.ceil((Date.parse(`${d.expiresOn}T00:00`) - Date.now()) / 864e5) }))
            .filter((d) => d.days <= 30)
            .sort((a, b) => a.days - b.days);
          return (
            <Tabs.Root defaultValue="queue">
              <Tabs.List>
                <Tabs.Trigger value="queue">Verification queue <Badge ml="2" color={pending.length ? "amber" : "gray"}>{pending.length}</Badge></Tabs.Trigger>
                <Tabs.Trigger value="expiry">Expiry tracker <Badge ml="2" color={withDays.length ? "red" : "gray"}>{withDays.length}</Badge></Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="queue">
                {pending.length === 0 ? <Empty>No documents waiting for verification.</Empty> : (
                  <Card mt="3" style={{ overflowX: "auto" }}>
                    <Table.Root size="1">
                      <Table.Header><Table.Row>
                        <Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Document</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Expires</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Uploaded</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
                      </Table.Row></Table.Header>
                      <Table.Body>
                        {pending.map((d) => (
                          <Table.Row key={d.id}>
                            <Table.Cell><Link href={`/workers/${d.workerId}`}>{d.workerName}</Link></Table.Cell>
                            <Table.Cell>{d.type}</Table.Cell>
                            <Table.Cell>{d.expiresOn ? day(d.expiresOn) : "No expiry"}</Table.Cell>
                            <Table.Cell>{fmtDate(d.uploadedAt)}</Table.Cell>
                            <Table.Cell>
                              <Flex gap="2" justify="end">
                                <ViewDocument doc={d} />
                                <Button size="1" color="green" onClick={() => decide(d.id, "verified")}>Verify</Button>
                                <Button size="1" color="red" variant="soft" onClick={() => decide(d.id, "rejected")}>Reject</Button>
                              </Flex>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Card>
                )}
              </Tabs.Content>

              <Tabs.Content value="expiry">
                <Flex justify="between" align="center" mt="3" gap="3" wrap="wrap">
                  <Text size="2" color="gray">{selected.size ? `${selected.size} selected` : "Select documents to remind workers to upload a new copy."}</Text>
                  <Flex gap="2">
                    <Button variant="soft" disabled={!withDays.length} onClick={() => remind(withDays.map((d) => d.id))}><PaperPlaneIcon /> Remind all ({withDays.length})</Button>
                    <Button disabled={!selected.size} onClick={() => remind([...selected])}><PaperPlaneIcon /> Remind selected</Button>
                  </Flex>
                </Flex>
                {BUCKETS.map((b) => {
                  const rows = withDays.filter((d) => b.test(d.days));
                  const allOn = rows.length > 0 && rows.every((d) => selected.has(d.id));
                  return (
                    <Card key={b.key} mt="3">
                      <Flex align="center" gap="2" mb="2">
                        {rows.length > 0 && <Checkbox checked={allOn} onCheckedChange={(v) => rows.forEach((d) => toggle(d.id, v === true))} aria-label={`Select all ${b.label}`} />}
                        <Badge color={b.color}>{b.label}</Badge><Text size="2" color="gray">{rows.length} documents</Text>
                      </Flex>
                      {rows.length > 0 && (
                        <Table.Root size="1">
                          <Table.Body>
                            {rows.map((d) => (
                              <Table.Row key={d.id}>
                                <Table.Cell width="32px"><Checkbox checked={selected.has(d.id)} onCheckedChange={(v) => toggle(d.id, v === true)} aria-label={`Select ${d.workerName} ${d.type}`} /></Table.Cell>
                                <Table.Cell><Link href={`/workers/${d.workerId}`}>{d.workerName}</Link></Table.Cell>
                                <Table.Cell>{d.type}</Table.Cell>
                                <Table.Cell>{day(d.expiresOn!)}</Table.Cell>
                                <Table.Cell>{d.days < 0 ? `${-d.days} days ago` : `${d.days} days left`}</Table.Cell>
                                <Table.Cell><Text size="1" color="gray">{d.lastRemindedAt ? `Reminded ${fmtDateTime(d.lastRemindedAt)}` : "Not reminded"}</Text></Table.Cell>
                                <Table.Cell><ViewDocument doc={d} /></Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      )}
                    </Card>
                  );
                })}
              </Tabs.Content>
            </Tabs.Root>
          );
        }}
      </Load>
    </>
  );
}

/** Document details. The file itself would open from S3 via a short-lived signed URL. */
function ViewDocument({ doc }: { doc: Doc }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger><Button size="1" variant="ghost"><EyeOpenIcon /> View</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>{doc.type}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{doc.workerName}</Dialog.Description>
        <Flex direction="column" align="center" justify="center" gap="2" mb="4" style={{ height: 160, borderRadius: 8, background: "var(--gray-a3)" }}>
          <FileTextIcon width={32} height={32} />
          <Text size="2">{doc.fileName}</Text>
          <Text size="1" color="gray">File preview isn't available in this demo.</Text>
        </Flex>
        <DataList.Root size="2">
          <DataList.Item><DataList.Label>Status</DataList.Label><DataList.Value><StatusBadge status={doc.status} /></DataList.Value></DataList.Item>
          <DataList.Item><DataList.Label>Expires</DataList.Label><DataList.Value>{doc.expiresOn ? day(doc.expiresOn) : "No expiry"}</DataList.Value></DataList.Item>
          <DataList.Item><DataList.Label>Uploaded</DataList.Label><DataList.Value>{fmtDateTime(doc.uploadedAt)}</DataList.Value></DataList.Item>
          {doc.sizeKb && <DataList.Item><DataList.Label>Size</DataList.Label><DataList.Value>{doc.sizeKb >= 1024 ? `${(doc.sizeKb / 1024).toFixed(1)} MB` : `${doc.sizeKb} KB`}</DataList.Value></DataList.Item>}
          {doc.lastRemindedAt && <DataList.Item><DataList.Label>Last reminder</DataList.Label><DataList.Value>{fmtDateTime(doc.lastRemindedAt)}</DataList.Value></DataList.Item>}
        </DataList.Root>
        <Flex justify="end" mt="4"><Dialog.Close><Button variant="soft" color="gray">Close</Button></Dialog.Close></Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function UploadDocument({ onSaved }: { onSaved: () => void }) {
  const send = useSend();
  const { data: workers } = useApi<Worker[]>("dummy:/workers");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const empty = { workerId: "", type: "" as DocType | "", expiresOn: "", file: null as File | null };
  const [f, setF] = useState(empty);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.file) return;
    try {
      // ponytail: only metadata is sent in the demo; production PUTs the file to a pre-signed S3 URL first.
      await send("/documents", "POST", {
        workerId: f.workerId, type: f.type, expiresOn: f.expiresOn || null, fileName: f.file.name, sizeKb: f.file.size / 1024,
      });
      setOpen(false);
      setF(empty);
      onSaved();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
      <Dialog.Trigger><Button><UploadIcon /> Upload document</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Upload document</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">For documents a worker sent by email or post. It goes into the verification queue.</Dialog.Description>
        <ErrorCallout error={error} />
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Worker</Text>
              <SearchSelect noun="worker" placeholder="Choose worker" value={f.workerId} onChange={(workerId) => setF({ ...f, workerId })}
                options={workers?.map((w) => ({ id: w.id, label: w.name, hint: w.skills.join(", ") })) ?? []} />
            </label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Document type</Text>
              <Select.Root value={f.type} onValueChange={(type) => setF({ ...f, type: type as DocType })}>
                <Select.Trigger placeholder="Choose type" style={{ width: "100%" }} />
                <Select.Content>{DOC_TYPES.map((t) => <Select.Item key={t} value={t}>{t}</Select.Item>)}</Select.Content>
              </Select.Root>
            </label>
            {f.type && f.type !== "References" && (
              <label>
                <Text as="div" size="2" weight="medium" mb="1">Expiry date</Text>
                <TextField.Root type="date" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} required />
              </label>
            )}
            <label>
              <Text as="div" size="2" weight="medium" mb="1">File</Text>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={(e) => setF({ ...f, file: e.target.files?.[0] ?? null })} />
              <Text as="div" size="1" color="gray" mt="1">PDF, JPG, PNG or HEIC, up to 10 MB.</Text>
            </label>
          </Flex>
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.workerId || !f.type || !f.file}>Upload</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
