"use client";
import { useMemo, useState } from "react";
import { Button, Flex, Select, Table, Text } from "@radix-ui/themes";
import { CaretDownIcon, CaretSortIcon, CaretUpIcon, ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";

type Value = string | number | boolean | null | undefined;

/**
 * Client-side sort + pagination for a table.
 * `sorters` maps a column key to the value to sort by.
 * ponytail: sorts in the browser; move to server-side paging once lists reach thousands of rows.
 */
export function useTable<T>(rows: T[], sorters: Record<string, (r: T) => Value>, initial?: { key: string; dir?: "asc" | "desc" }, pageSize = 20) {
  const [sort, setSort] = useState(initial ? { key: initial.key, dir: initial.dir ?? "asc" } : null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);

  const sorted = useMemo(() => {
    if (!sort || !sorters[sort.key]) return rows;
    const get = sorters[sort.key];
    const m = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(String(y)) : Number(x) - Number(y)) * m;
    });
  }, [rows, sort]); // sorters is recreated each render; rows + sort are what matter

  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const current = Math.min(page, pages - 1); // stay in range when filters shrink the list
  return {
    rows: sorted.slice(current * size, current * size + size),
    total: sorted.length,
    sort,
    toggle: (key: string) => {
      setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
      setPage(0);
    },
    pager: { page: current, pages, size, total: sorted.length, setPage, setSize: (n: number) => { setSize(n); setPage(0); } },
  };
}

export function SortHeader({ label, k, t }: { label: string; k: string; t: { sort: { key: string; dir: string } | null; toggle: (k: string) => void } }) {
  const active = t.sort?.key === k;
  const Icon = !active ? CaretSortIcon : t.sort!.dir === "asc" ? CaretUpIcon : CaretDownIcon;
  return (
    <Table.ColumnHeaderCell aria-sort={active ? (t.sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => t.toggle(k)} style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label} <Icon color={active ? undefined : "var(--gray-8)"} />
      </button>
    </Table.ColumnHeaderCell>
  );
}

export function Pager({ page, pages, size, total, setPage, setSize }: ReturnType<typeof useTable>["pager"]) {
  if (total <= 10) return null;
  const from = page * size + 1;
  const to = Math.min(total, from + size - 1);
  return (
    <Flex justify="between" align="center" mt="3" gap="3" wrap="wrap">
      <Text size="1" color="gray">{from}–{to} of {total}</Text>
      <Flex align="center" gap="2">
        <Select.Root size="1" value={String(size)} onValueChange={(v) => setSize(Number(v))}>
          <Select.Trigger aria-label="Rows per page" />
          <Select.Content>{[10, 20, 50, 100].map((n) => <Select.Item key={n} value={String(n)}>{n} / page</Select.Item>)}</Select.Content>
        </Select.Root>
        <Button size="1" variant="soft" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeftIcon /></Button>
        <Text size="1">Page {page + 1} of {pages}</Text>
        <Button size="1" variant="soft" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRightIcon /></Button>
      </Flex>
    </Flex>
  );
}
