"use client";
import { Badge, Callout, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import type { ComplianceStatus, ShiftStatus } from "@/lib/types";
import type { ApiError } from "@/lib/client";

type Color = React.ComponentProps<typeof Badge>["color"];

const SHIFT_COLOR: Record<ShiftStatus, Color> = {
  open: "orange", applied: "amber", assigned: "blue", confirmed: "indigo",
  in_progress: "cyan", completed: "green", cancelled: "gray", no_show: "red",
};
export function ShiftBadge({ status }: { status: ShiftStatus }) {
  return <Badge color={SHIFT_COLOR[status]}>{status.replace("_", " ")}</Badge>;
}

const COMPLIANCE_COLOR: Record<ComplianceStatus, Color> = { compliant: "green", expiring: "amber", pending: "blue", blocked: "red" };
export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  return <Badge color={COMPLIANCE_COLOR[status]}>{status === "blocked" ? "blocked: not bookable" : status}</Badge>;
}

const STATUS_COLOR: Record<string, Color> = {
  pending: "amber", approved: "green", verified: "green", accepted: "green", disputed: "red", rejected: "red",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLOR[status] ?? "gray"}>{status}</Badge>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <Flex justify="between" align={{ initial: "start", sm: "center" }} direction={{ initial: "column", sm: "row" }} gap="3" mb="5">
      <div>
        <Heading size="6">{title}</Heading>
        {subtitle && <Text as="p" color="gray" size="2" mt="1">{subtitle}</Text>}
      </div>
      {children && <Flex gap="2" wrap="wrap">{children}</Flex>}
    </Flex>
  );
}

export function ErrorCallout({ error }: { error?: ApiError | { message: string; reasons?: string[] } }) {
  if (!error) return null;
  return (
    <Callout.Root color="red" mb="4">
      <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
      <Callout.Text>
        {error.message}
        {!!error.reasons?.length && <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{error.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      </Callout.Text>
    </Callout.Root>
  );
}

export function Loading() {
  return <Flex align="center" gap="2" p="6"><Spinner /><Text color="gray">Loading…</Text></Flex>;
}

/** Shows error if any, spinner until data arrives, then children. */
export function Load<T>({ data, error, children }: { data?: T; error?: ApiError; children: (d: T) => React.ReactNode }) {
  if (error) return <ErrorCallout error={error} />;
  if (data === undefined) return <Loading />;
  return <>{children(data)}</>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <Text as="p" color="gray" size="2" my="4">{children}</Text>;
}
