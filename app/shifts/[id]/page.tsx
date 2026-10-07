"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Flex, Text } from "@radix-ui/themes";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { ShiftManager } from "@/components/ShiftManager";

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <Link href="/shifts" style={{ textDecoration: "none" }}><Text size="2" color="gray"><Flex align="center" gap="1" mb="3"><ArrowLeftIcon /> All shifts</Flex></Text></Link>
      <ShiftManager id={id} />
    </>
  );
}
