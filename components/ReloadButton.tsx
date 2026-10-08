"use client";
import { IconButton, Tooltip } from "@radix-ui/themes";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useIsFetching } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";

/** Fetches every query on the current page again by bumping the global reloadCount (part of every query key). */
export function ReloadButton() {
  const reload = useAppStore((s) => s.reload);
  const fetching = useIsFetching({ queryKey: ["api"] }) > 0;
  return (
    <Tooltip content="Reload">
      <IconButton variant="soft" color="gray" onClick={reload} disabled={fetching} aria-label="Reload this page's data">
        <ReloadIcon className={fetching ? "spin" : undefined} />
      </IconButton>
    </Tooltip>
  );
}
