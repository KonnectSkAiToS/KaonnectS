"use client";
import { useMemo, useState } from "react";
import { Badge, Box, Button, Checkbox, Flex, ScrollArea, Switch, Text, TextField } from "@radix-ui/themes";
import { Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";

export interface Option { id: string; label: string; hint?: string }

/**
 * Searchable checkbox list for picking many items out of a long list (50+ clients, sites, workers).
 * "Select all" / "Clear" apply to what the search currently shows.
 */
export function MultiSelect({ options, value, onChange, noun = "item", height = 240, allowEmpty = false }: {
  options: Option[]; value: string[]; onChange: (ids: string[]) => void; noun?: string; height?: number;
  /** When true, selecting nothing is valid (no "select at least one" prompt). */
  allowEmpty?: boolean;
}) {
  const [q, setQ] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const shown = options.filter((o) =>
    (!onlySelected || selected.has(o.id)) &&
    `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const shownSelected = shown.filter((o) => selected.has(o.id)).length;
  const plural = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));
  const selectShown = () => onChange([...new Set([...value, ...shown.map((o) => o.id)])]);
  const clearShown = () => { const drop = new Set(shown.map((o) => o.id)); onChange(value.filter((id) => !drop.has(id))); };

  return (
    <Box style={{ border: "1px solid var(--gray-a6)", borderRadius: "var(--radius-3)" }}>
      <Box p="2" style={{ borderBottom: "1px solid var(--gray-a5)" }}>
        <TextField.Root placeholder={`Search ${options.length} ${noun}s`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${noun}s`}>
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
          {q && <TextField.Slot><Button type="button" size="1" variant="ghost" color="gray" onClick={() => setQ("")} aria-label="Clear search"><Cross2Icon /></Button></TextField.Slot>}
        </TextField.Root>
        <Flex justify="between" align="center" mt="2" gap="2" wrap="wrap">
          <Flex gap="2">
            <Button type="button" size="1" variant="soft" disabled={!shown.length || shownSelected === shown.length} onClick={selectShown}>
              Select {q || onlySelected ? `${shown.length} shown` : "all"}
            </Button>
            <Button type="button" size="1" variant="soft" color="gray" disabled={!shownSelected} onClick={clearShown}>
              Clear{q || onlySelected ? " shown" : ""}
            </Button>
          </Flex>
          <Text as="label" size="1" color="gray">
            <Flex gap="1" align="center"><Switch size="1" checked={onlySelected} onCheckedChange={setOnlySelected} /> Selected only</Flex>
          </Text>
        </Flex>
      </Box>

      <ScrollArea style={{ height: Math.min(height, Math.max(44, shown.length * 34 + 8)) }} scrollbars="vertical">
        <Box p="1">
          {shown.length === 0 && <Text as="p" size="2" color="gray" m="2">No {noun}s match “{q}”.</Text>}
          {shown.map((o) => (
            <Text as="label" key={o.id} size="2" className="rowlink" style={{ display: "block", padding: "6px 8px", borderRadius: 6 }}>
              <Flex gap="2" align="center">
                <Checkbox checked={selected.has(o.id)} onCheckedChange={(v) => toggle(o.id, v === true)} />
                <span style={{ flex: 1, minWidth: 0 }}>{o.label}</span>
                {o.hint && <Text size="1" color="gray" style={{ flexShrink: 0 }}>{o.hint}</Text>}
              </Flex>
            </Text>
          ))}
        </Box>
      </ScrollArea>

      <Box p="2" style={{ borderTop: "1px solid var(--gray-a5)" }}>
        <Text as="div" size="1" color={value.length || allowEmpty ? undefined : "red"} mb={value.length ? "2" : "0"}>
          {value.length ? `${plural(value.length)} selected` : allowEmpty ? `No ${noun}s selected` : `Select at least one ${noun}`}
        </Text>
        {value.length > 0 && (
          <Flex gap="1" wrap="wrap" style={{ maxHeight: 64, overflowY: "auto" }}>
            {value.slice(0, 12).map((id) => (
              <Badge key={id} variant="soft" radius="full">
                {byId.get(id)?.label ?? id}
                <button type="button" onClick={() => toggle(id, false)} aria-label={`Remove ${byId.get(id)?.label ?? id}`}
                  style={{ all: "unset", cursor: "pointer", display: "inline-flex", marginLeft: 2 }}><Cross2Icon width={12} height={12} /></button>
              </Badge>
            ))}
            {value.length > 12 && (
              <Button type="button" size="1" variant="ghost" onClick={() => { setOnlySelected(true); setQ(""); }}>+{value.length - 12} more</Button>
            )}
          </Flex>
        )}
      </Box>
    </Box>
  );
}
