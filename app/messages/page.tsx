"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar, Badge, Box, Button, Card, Dialog, Flex, IconButton, Select, Text, TextArea, TextField } from "@radix-ui/themes";
import { ArrowLeftIcon, MagnifyingGlassIcon, PaperPlaneIcon, Pencil2Icon } from "@radix-ui/react-icons";
import { ApiError, fmtDate, fmtTime, useApi, useSend } from "@/lib/client";
import { Empty, ErrorCallout, Load, Loading, PageHeader } from "@/components/ui";
import type { Conversation, Message, ShiftView, Worker } from "@/lib/types";

type Summary = Conversation & { workerName: string; last?: Message; count: number };
interface Thread { conversation: Conversation; worker: Worker; shift: ShiftView | null; messages: Message[] }

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("");
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
/** "16:45" today, "Tue 06 Oct" otherwise. */
const when = (iso: string) => (sameDay(iso, new Date().toISOString()) ? fmtTime(iso) : fmtDate(iso));

export default function MessagesPage() {
  const list = useApi<Summary[]>("/conversations");
  const [selected, setSelected] = useState<string>();
  const [q, setQ] = useState("");
  const active = selected ?? list.data?.[0]?.id;

  return (
    <>
      <PageHeader title="Messages" subtitle="Chat with workers. Threads can't be edited or deleted, so they stand as an audit trail for CQC.">
        <NewConversation onCreated={(id) => { list.reload(); setSelected(id); }} />
      </PageHeader>
      <Load data={list.data} error={list.error}>
        {(convs) => {
          const shown = convs.filter((c) => `${c.workerName} ${c.subject}`.toLowerCase().includes(q.toLowerCase()));
          return (
            <Card className={`chat${selected ? " thread-open" : ""}`} style={{ padding: 0 }}>
              <Flex direction="column" className="chat-list">
                <Box p="3" style={{ borderBottom: "1px solid var(--gray-a5)" }}>
                  <TextField.Root placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)}>
                    <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
                  </TextField.Root>
                </Box>
                <Box style={{ overflowY: "auto", flex: 1 }}>
                  {shown.length === 0 && <Box p="3"><Empty>No conversations match.</Empty></Box>}
                  {shown.map((cv) => (
                    <Flex key={cv.id} gap="3" p="3" className="rowlink" onClick={() => setSelected(cv.id)}
                      style={{ borderBottom: "1px solid var(--gray-a3)", background: cv.id === active ? "var(--accent-a3)" : undefined }}>
                      <Avatar size="2" radius="full" fallback={initials(cv.workerName)} />
                      <Box minWidth="0" flexGrow="1">
                        <Flex justify="between" align="baseline" gap="2">
                          <Text size="2" weight="bold" truncate>{cv.workerName}</Text>
                          {cv.last && <Text size="1" color="gray" style={{ flexShrink: 0 }}>{when(cv.last.at)}</Text>}
                        </Flex>
                        <Text as="div" size="1" weight="medium" truncate>{cv.subject}</Text>
                        {cv.last && <Text as="div" size="1" color="gray" truncate>{cv.last.from === "agency" ? "You: " : ""}{cv.last.body}</Text>}
                      </Box>
                    </Flex>
                  ))}
                </Box>
              </Flex>
              <Flex direction="column" className="chat-thread" minWidth="0">
                {active ? <ThreadView key={active} id={active} onSent={list.reload} onBack={() => setSelected(undefined)} />
                  : <Flex align="center" justify="center" flexGrow="1"><Text color="gray">Select a conversation</Text></Flex>}
              </Flex>
            </Card>
          );
        }}
      </Load>
    </>
  );
}

function ThreadView({ id, onSent, onBack }: { id: string; onSent: () => void; onBack: () => void }) {
  const send = useSend();
  const { data, error, reload } = useApi<Thread>(`/conversations/${id}`);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ApiError>();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [data]);

  async function submit() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await send(`/conversations/${id}`, "POST", { body: text });
      setText("");
      setSendError(undefined);
      reload();
      onSent();
    } catch (e) {
      setSendError(e as ApiError);
    }
    setSending(false);
  }

  if (error) return <Box p="4"><ErrorCallout error={error} /></Box>;
  if (!data) return <Loading />;
  const { conversation, worker, shift, messages } = data;

  return (
    <>
      <Flex align="center" gap="3" px="4" py="3" style={{ borderBottom: "1px solid var(--gray-a5)" }}>
        <IconButton variant="ghost" color="gray" className="chat-back" onClick={onBack} aria-label="Back to conversations"><ArrowLeftIcon /></IconButton>
        <Avatar size="3" radius="full" fallback={initials(worker.name)} />
        <Box minWidth="0" flexGrow="1">
          <Text as="div" weight="bold" truncate>{conversation.subject}</Text>
          <Text as="div" size="1" color="gray" truncate>
            <Link href={`/workers/${worker.id}`}>{worker.name}</Link> · {worker.phone}
          </Text>
        </Box>
        {shift && (
          <Link href={`/shifts/${shift.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
            <Badge size="2" variant="surface">{shift.role} · {shift.siteName} · {fmtDate(shift.start)} {fmtTime(shift.start)}</Badge>
          </Link>
        )}
      </Flex>

      <Box px="4" py="3" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <Flex direction="column" gap="2">
          {messages.map((m, i) => {
            const mine = m.from === "agency";
            const newDay = i === 0 || !sameDay(messages[i - 1].at, m.at);
            const grouped = !newDay && messages[i - 1].from === m.from;
            return (
              <Box key={m.id}>
                {newDay && (
                  <Flex justify="center" my="2"><Badge color="gray" variant="soft" radius="full">{fmtDate(m.at)}</Badge></Flex>
                )}
                <Flex justify={mine ? "end" : "start"} mt={grouped ? "0" : "2"}>
                  <Box px="3" py="2" style={{
                    maxWidth: "min(75%, 560px)",
                    borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: mine ? "var(--accent-9)" : "var(--gray-a3)",
                    color: mine ? "var(--accent-contrast)" : undefined,
                  }}>
                    <Text as="div" size="2" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</Text>
                    <Text as="div" size="1" mt="1" style={{ opacity: 0.7, textAlign: mine ? "right" : "left" }}>
                      {mine ? `${m.author} · ` : ""}{fmtTime(m.at)}
                    </Text>
                  </Box>
                </Flex>
              </Box>
            );
          })}
          <div ref={end} />
        </Flex>
      </Box>

      <Box px="4" pt="3" pb="2" style={{ borderTop: "1px solid var(--gray-a5)" }}>
        <ErrorCallout error={sendError} />
        <Flex gap="2" align="end">
          <Box flexGrow="1">
            <TextArea placeholder={`Message ${worker.name.split(" ")[0]}…`} value={text} maxLength={2000} rows={2} resize="vertical"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
          </Box>
          <IconButton size="3" onClick={submit} disabled={!text.trim() || sending} aria-label="Send"><PaperPlaneIcon /></IconButton>
        </Flex>
        <Text as="p" size="1" color="gray" mt="1">Enter to send · Shift + Enter for a new line</Text>
      </Box>
    </>
  );
}

function NewConversation({ onCreated }: { onCreated: (id: string) => void }) {
  const send = useSend();
  const { data: workers } = useApi<Worker[]>("/workers");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ApiError>();
  const [f, setF] = useState({ workerId: "", subject: "", body: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { id } = await send<{ id: string }>("/conversations", "POST", f);
      setOpen(false);
      setF({ workerId: "", subject: "", body: "" });
      onCreated(id);
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); setError(undefined); }}>
      <Dialog.Trigger><Button><Pencil2Icon /> New message</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>New message</Dialog.Title>
        <ErrorCallout error={error} />
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <Select.Root value={f.workerId} onValueChange={(workerId) => setF({ ...f, workerId })}>
              <Select.Trigger placeholder="Choose worker" />
              <Select.Content>{workers?.map((w) => <Select.Item key={w.id} value={w.id}>{w.name}</Select.Item>)}</Select.Content>
            </Select.Root>
            <TextField.Root placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
            <TextArea placeholder="Message" rows={4} maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </Flex>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close><Button type="button" variant="soft" color="gray">Cancel</Button></Dialog.Close>
            <Button type="submit" disabled={!f.workerId || !f.subject.trim() || !f.body.trim()}>Send</Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
