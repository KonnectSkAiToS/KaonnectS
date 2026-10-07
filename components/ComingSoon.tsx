import { Card, Text } from "@radix-ui/themes";
import { PageHeader } from "./ui";

export function ComingSoon({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <PageHeader title={title} subtitle="Planned for Phase 2." />
      <Card>
        <Text as="p" size="2" color="gray" mb="2">This module will include:</Text>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map((i) => <li key={i}><Text size="2">{i}</Text></li>)}</ul>
      </Card>
    </>
  );
}
