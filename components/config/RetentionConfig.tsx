"use client";
import { useState } from "react";
import { Button, Card, Flex, Table, Text, TextField } from "@radix-ui/themes";
import { ApiError, useApi, useSend } from "@/lib/client";
import { ErrorCallout, Load } from "@/components/ui";
import type { RetentionRule } from "@/lib/types";


/** Configuration → Data: how long each kind of record is kept. */
export function RetentionConfig({ readOnly = false }: { readOnly?: boolean }) {
  const send = useSend();
  const { data, error, reload } = useApi<RetentionRule[]>("/config/retention");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<ApiError>();

  async function save(r: RetentionRule) {
    try {
      setActionError(undefined);
      await send(`/config/retention/${r.id}`, "PATCH", { months: Number(edits[r.id]) });
      setEdits(({ [r.id]: _, ...rest }) => rest);
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  return (
    <Flex direction="column" gap="3" mt="3">
      <Text size="2" color="gray">How long each kind of record is kept before it's deleted or anonymised. Set these with your compliance lead and check them against current CQC and HMRC guidance.</Text>
      <ErrorCallout error={actionError} />
      <Load data={data} error={error}>
        {(rows) => (
          <Card style={{ overflowX: "auto" }}>
            <Table.Root size="1">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Record type</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Keep for</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Counted from</Table.ColumnHeaderCell><Table.ColumnHeaderCell />
              </Table.Row></Table.Header>
              <Table.Body>
                {rows.map((r) => {
                  const v = edits[r.id] ?? String(r.months);
                  return (
                    <Table.Row key={r.id}>
                      <Table.Cell><Text weight="medium">{r.category}</Text></Table.Cell>
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <TextField.Root type="number" min={1} max={240} value={v} disabled={readOnly} style={{ width: 80 }} onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })} />
                          <Text size="1" color="gray">months{Number(v) >= 12 && ` (${(Number(v) / 12).toFixed(1).replace(".0", "")} yrs)`}</Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell><Text size="2" color="gray">{r.basis}</Text></Table.Cell>
                      <Table.Cell>{edits[r.id] !== undefined && Number(v) !== r.months && <Button size="1" onClick={() => save(r)}>Save</Button>}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Card>
        )}
      </Load>
    </Flex>
  );
}

