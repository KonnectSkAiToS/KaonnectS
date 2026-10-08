"use client";
import { useEffect, useState } from "react";
import { Box, Button, Callout, Flex, Text, TextField } from "@radix-ui/themes";
import { ResetIcon } from "@radix-ui/react-icons";
import { ApiError, useSettings, useSend } from "@/lib/client";
import { ErrorCallout, Load } from "@/components/ui";

/**
 * Form for every setting in one module, drawn from the API's setting definitions
 * (label, help, type, limits, unit). Only changed values are sent.
 */
export function SettingsForm({ module, readOnly = false }: { module: string; readOnly?: boolean }) {
  const send = useSend();
  const { settings, error, reload } = useSettings();
  const defs = settings?.filter((s) => s.module === module);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<ApiError>();
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft({}); }, [module]);

  const changed = Object.entries(draft).filter(([k, v]) => {
    const d = defs?.find((s) => s.key === k);
    return d && String(d.value) !== v;
  });

  async function save() {
    try {
      setSaveError(undefined);
      const body = Object.fromEntries(changed.map(([k, v]) => {
        const d = defs!.find((s) => s.key === k)!;
        return [k, d.type === "number" ? Number(v) : v];
      }));
      await send("/config/settings", "PATCH", body);
      setDraft({});
      setSaved(true);
      reload();
    } catch (e) {
      setSaveError(e as ApiError);
    }
  }

  return (
    <Load data={defs} error={error}>
      {(rows) => (
        <Flex direction="column" gap="4" mt="2">
          {rows.map((s) => {
            const value = draft[s.key] ?? String(s.value);
            const isDefault = String(s.value) === String(s.default) && draft[s.key] === undefined;
            const limits = s.type === "number" && (s.min !== undefined || s.max !== undefined)
              ? `Allowed ${s.min ?? "…"}–${s.max ?? "…"}${s.unit ? ` ${s.unit}` : ""}` : null;
            return (
              <Flex key={s.key} gap="4" justify="between" align="start" wrap="wrap" pb="3" style={{ borderBottom: "1px solid var(--gray-a4)" }}>
                <Box style={{ flex: "1 1 320px" }}>
                  <Text as="div" size="2" weight="medium">{s.label}</Text>
                  <Text as="div" size="1" color="gray">{s.help}</Text>
                  {limits && <Text as="div" size="1" color="gray">{limits} · default {String(s.default)}{s.unit ? ` ${s.unit}` : ""}</Text>}
                </Box>
                <Flex gap="2" align="center">
                  <TextField.Root type={s.type === "time" ? "time" : "number"} value={value} disabled={readOnly}
                    min={s.min} max={s.max} step={s.step} style={{ width: 120 }} aria-label={s.label}
                    onChange={(e) => { setSaved(false); setDraft({ ...draft, [s.key]: e.target.value }); }}>
                    {s.unit && <TextField.Slot side="right"><Text size="1" color="gray">{s.unit}</Text></TextField.Slot>}
                  </TextField.Root>
                  {!readOnly && (
                    <Button size="1" variant="ghost" color="gray" disabled={isDefault || value === String(s.default)} title="Reset to default"
                      onClick={() => { setSaved(false); setDraft({ ...draft, [s.key]: String(s.default) }); }}>
                      <ResetIcon />
                    </Button>
                  )}
                </Flex>
              </Flex>
            );
          })}
          <ErrorCallout error={saveError} />
          {saved && !changed.length && <Callout.Root color="green" size="1"><Callout.Text>Saved. Changes apply from now on.</Callout.Text></Callout.Root>}
          {!readOnly && (
            <Flex gap="2" justify="end">
              <Button variant="soft" color="gray" disabled={!changed.length} onClick={() => setDraft({})}>Discard</Button>
              <Button disabled={!changed.length} onClick={save}>Save {changed.length ? `${changed.length} change${changed.length === 1 ? "" : "s"}` : "changes"}</Button>
            </Flex>
          )}
        </Flex>
      )}
    </Load>
  );
}
