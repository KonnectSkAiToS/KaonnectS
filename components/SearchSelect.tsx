"use client";
import { useState } from "react";
import { Box, Button, Flex, Popover, ScrollArea, Text, TextField } from "@radix-ui/themes";
import { CaretSortIcon, CheckIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import type { Option } from "./MultiSelect";

/** Single pick from a long list (workers, clients, sites) with type-to-search. Enter picks the first match. */
export function SearchSelect({ options, value, onChange, placeholder = "Choose…", noun = "item" }: {
  options: Option[]; value: string; onChange: (id: string) => void; placeholder?: string; noun?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = options.find((o) => o.id === value);
  const shown = options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (id: string) => { onChange(id); setOpen(false); setQ(""); };

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <Popover.Trigger>
        <Button type="button" variant="surface" color="gray" style={{ width: "100%", justifyContent: "space-between", fontWeight: 400 }}>
          <Text truncate color={current ? undefined : "gray"}>{current?.label ?? placeholder}</Text>
          <CaretSortIcon />
        </Button>
      </Popover.Trigger>
      <Popover.Content style={{ width: "var(--radix-popover-trigger-width)", padding: 0 }} align="start">
        <Box p="2" style={{ borderBottom: "1px solid var(--gray-a5)" }}>
          <TextField.Root autoFocus placeholder={`Search ${options.length} ${noun}s`} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && shown[0]) { e.preventDefault(); pick(shown[0].id); } }} aria-label={`Search ${noun}s`}>
            <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
          </TextField.Root>
        </Box>
        <ScrollArea style={{ maxHeight: 260 }} scrollbars="vertical">
          <Box p="1" role="listbox">
            {shown.length === 0 && <Text as="p" size="2" color="gray" m="2">No {noun}s match “{q}”.</Text>}
            {shown.map((o) => (
              <button key={o.id} type="button" role="option" aria-selected={o.id === value} onClick={() => pick(o.id)} className="rowlink"
                style={{ all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}>
                <Flex gap="2" align="center">
                  <span style={{ width: 15, display: "inline-flex" }}>{o.id === value && <CheckIcon />}</span>
                  <Text size="2" style={{ flex: 1, minWidth: 0 }} truncate>{o.label}</Text>
                  {o.hint && <Text size="1" color="gray" style={{ flexShrink: 0 }}>{o.hint}</Text>}
                </Flex>
              </button>
            ))}
          </Box>
        </ScrollArea>
      </Popover.Content>
    </Popover.Root>
  );
}
