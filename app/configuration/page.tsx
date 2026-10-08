"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge, Box, Callout, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { EyeOpenIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useRole } from "@/lib/client";
import { PageHeader } from "@/components/ui";
import { RolesSettings } from "@/components/RolesSettings";
import { TemplatesConfig } from "@/components/config/TemplatesConfig";
import { RetentionConfig } from "@/components/config/RetentionConfig";

interface Section {
  id: string;
  module: string;
  label: string;
  description: string;
  keywords: string; // extra words the search should match
  render: (readOnly: boolean) => React.ReactNode;
}

/**
 * Every configurable part of the agency's setup, grouped by the module it affects.
 * Add a section here and it appears in the sub-menu and the search.
 */
const SECTIONS: Section[] = [
  {
    id: "job-roles", module: "Workforce", label: "Job roles",
    description: "Roles you staff, the documents each needs, default pay, and which clients they're offered for.",
    keywords: "skills carer chef nurse documents dbs pay",
    render: (ro) => <RolesSettings readOnly={ro} />,
  },
  {
    id: "notifications", module: "Notifications", label: "Message templates",
    description: "Push, SMS and email messages sent to workers, with placeholders like {{site}} and {{date}}.",
    keywords: "sms email push reminder text message",
    render: (ro) => <TemplatesConfig readOnly={ro} />,
  },
  {
    id: "retention", module: "Data", label: "Data retention",
    description: "How long each kind of record is kept before it's deleted or anonymised.",
    keywords: "gdpr delete keep months records privacy",
    render: (ro) => <RetentionConfig readOnly={ro} />,
  },
];
const MODULES = [...new Set(SECTIONS.map((s) => s.module))];

export default function ConfigurationPage() {
  return <Suspense><Configuration /></Suspense>;
}

function Configuration() {
  const router = useRouter();
  const params = useSearchParams();
  const { role } = useRole();
  const readOnly = role !== "super_admin";
  const [q, setQ] = useState("");
  const active = SECTIONS.find((s) => s.id === params.get("section")) ?? SECTIONS[0];
  const open = (id: string) => router.replace(`/configuration?section=${id}`, { scroll: false });

  const term = q.trim().toLowerCase();
  const matches = (s: Section) => !term || `${s.module} ${s.label} ${s.description} ${s.keywords}`.toLowerCase().includes(term);

  return (
    <>
      <PageHeader title="Configuration" subtitle="Set up how your agency works, in one place. Changes apply across the portal and the worker app." />
      {readOnly && (
        <Callout.Root color="gray" mb="4">
          <Callout.Icon><EyeOpenIcon /></Callout.Icon>
          <Callout.Text>You can view the configuration. Only a Super Admin can change it.</Callout.Text>
        </Callout.Root>
      )}
      <Flex gap="5" direction={{ initial: "column", md: "row" }} align="start">
        <Box style={{ width: "100%", maxWidth: 260, flexShrink: 0 }}>
          <TextField.Root placeholder="Search configuration" value={q} onChange={(e) => setQ(e.target.value)} mb="3">
            <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
          </TextField.Root>
          <nav aria-label="Configuration sections">
            {MODULES.map((m) => {
              const items = SECTIONS.filter((s) => s.module === m && matches(s));
              if (!items.length) return null;
              return (
                <Box key={m} mb="3">
                  <Text as="div" size="1" weight="bold" color="gray" mb="1" style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>{m}</Text>
                  {items.map((s) => (
                    <button key={s.id} type="button" onClick={() => open(s.id)} aria-current={s.id === active.id ? "page" : undefined}
                      className={`navlink${s.id === active.id ? " active" : ""}`} style={{ width: "100%", border: 0, background: s.id === active.id ? undefined : "none", cursor: "pointer", font: "inherit" }}>
                      {s.label}
                    </button>
                  ))}
                </Box>
              );
            })}
            {!SECTIONS.some(matches) && <Text size="2" color="gray">Nothing matches “{q}”.</Text>}
          </nav>
        </Box>

        <Card style={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Flex align="center" gap="2" mb="1">
            <Badge color="gray">{active.module}</Badge>
            <Heading size="4">{active.label}</Heading>
          </Flex>
          <Text as="p" size="2" color="gray" mb="2">{active.description}</Text>
          {active.render(readOnly)}
        </Card>
      </Flex>
    </>
  );
}
