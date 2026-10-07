import Link from "next/link";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

export function NotFound({ title = "Page not found", message = "The link may be wrong, or the page has moved." }: { title?: string; message?: string }) {
  return (
    <Flex justify="center" pt="9">
      <Card size="4" style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <Flex direction="column" align="center" gap="3">
          <MagnifyingGlassIcon width={28} height={28} color="var(--gray-9)" />
          <Heading size="5">{title}</Heading>
          <Text color="gray" size="2">{message}</Text>
          <Link href="/"><Button variant="soft">Back to dashboard</Button></Link>
        </Flex>
      </Card>
    </Flex>
  );
}
