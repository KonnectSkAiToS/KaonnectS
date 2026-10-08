"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Box, DropdownMenu, Flex, IconButton, Spinner, Text, Tooltip } from "@radix-ui/themes";
import {
  BarChartIcon, CalendarIcon, ChatBubbleIcon, ClockIcon, DashboardIcon, FileTextIcon, GearIcon,
  DesktopIcon, DoubleArrowLeftIcon, DoubleArrowRightIcon, HamburgerMenuIcon, HomeIcon, IdCardIcon, LayersIcon, ListBulletIcon, ReaderIcon, MoonIcon, ExitIcon, PersonIcon, SunIcon,
} from "@radix-ui/react-icons";
import { ROLE_LABEL, useAuth } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import { useThemeMode, type ThemeMode } from "./AppTheme";
import type { Role } from "@/lib/types";

const ALL: Role[] = ["super_admin", "coordinator", "client_admin"];
const NAV: { href: string; label: string; icon: React.ReactNode; roles: Role[] }[] = [
  { href: "/", label: "Dashboard", icon: <DashboardIcon />, roles: ALL },
  { href: "/shifts", label: "Shifts", icon: <ListBulletIcon />, roles: ALL },
  { href: "/rota", label: "Rota", icon: <CalendarIcon />, roles: ALL },
  { href: "/attendance", label: "Attendance", icon: <ClockIcon />, roles: ALL },
  { href: "/timesheets", label: "Timesheets & Pay", icon: <FileTextIcon />, roles: ALL },
  { href: "/workers", label: "Workers", icon: <PersonIcon />, roles: ALL },
  { href: "/compliance", label: "Compliance", icon: <IdCardIcon />, roles: ["super_admin", "coordinator"] },
  { href: "/clients", label: "Clients & Sites", icon: <HomeIcon />, roles: ALL },
  { href: "/reports", label: "Reports", icon: <BarChartIcon />, roles: ALL },
  { href: "/leave", label: "Leave", icon: <SunIcon />, roles: ALL },
  { href: "/messages", label: "Messages", icon: <ChatBubbleIcon />, roles: ["super_admin", "coordinator"] },
  { href: "/invoices", label: "Invoices", icon: <ReaderIcon />, roles: ["super_admin", "client_admin"] },
  { href: "/settings", label: "Settings & Audit", icon: <GearIcon />, roles: ["super_admin"] },
  { href: "/platform", label: "Platform & Tenants", icon: <LayersIcon />, roles: ["super_admin"] },
];

const THEME_ICON: Record<ThemeMode, React.ReactNode> = { light: <SunIcon />, dark: <MoonIcon />, system: <DesktopIcon /> };

const PUBLIC_PATHS = ["/login"];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const isPublic = PUBLIC_PATHS.includes(path);

  // Signed-out users go to the login page, then come back to where they were.
  useEffect(() => {
    if (status === "signed-out" && !isPublic) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [status, isPublic, path, router]);

  if (isPublic) return <>{children}</>;
  if (!user) {
    return <Flex align="center" justify="center" minHeight="100vh"><Spinner size="3" /></Flex>;
  }
  return <SignedInShell user={user} path={path} onLogout={logout}>{children}</SignedInShell>;
}

function SignedInShell({ user, path, onLogout, children }: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>; path: string; onLogout: () => Promise<void>; children: React.ReactNode;
}) {
  const role = user.role;
  const [open, setOpen] = useState(false); // mobile drawer
  const collapsed = useAppStore((s) => s.sidebarCollapsed); // desktop icon-only rail (persisted)
  const toggleCollapsed = useAppStore((s) => s.toggleSidebar);
  const { mode, setMode, brand } = useThemeMode();
  const allowed = NAV.find((n) => n.href !== "/" && path.startsWith(n.href))?.roles ?? ALL;

  return (
    <Flex minHeight="100vh">
      <IconButton variant="surface" color="gray" className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><HamburgerMenuIcon /></IconButton>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <Box asChild className={`sidebar${open ? " open" : ""}${collapsed ? " collapsed" : ""}`}>
        <nav>
          <Flex direction="column" gap="1" p="3" height="100%">
            <Flex align="center" justify="between" mb="3" className="brand">
              <Text size="3" weight="bold" ml="2" className="label" truncate>{brand.name}</Text>
              <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                <IconButton variant="ghost" color="gray" className="collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                  {collapsed ? <DoubleArrowRightIcon /> : <DoubleArrowLeftIcon />}
                </IconButton>
              </Tooltip>
            </Flex>
            {NAV.filter((n) => n.roles.includes(role)).map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              const link = (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`navlink${active ? " active" : ""}`} aria-label={n.label}>
                  {n.icon}
                  <span className="label" style={{ flex: 1 }}>{n.label}</span>
                </Link>
              );
              return collapsed ? <Tooltip key={n.href} content={n.label} side="right">{link}</Tooltip> : link;
            })}

            <Box mt="auto" pt="3" style={{ borderTop: "1px solid var(--gray-a5)" }}>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <button className="navlink profile" aria-label="Account and theme">
                    <Avatar size="2" radius="full" fallback={user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")} />
                    <span className="label" style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <Text as="div" size="2" weight="medium" truncate>{user.name}</Text>
                      <Text as="div" size="1" color="gray" truncate>{ROLE_LABEL[role]}</Text>
                    </span>
                    <span className="label">{THEME_ICON[mode]}</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content side="top" align="start" style={{ minWidth: 220 }}>
                  <DropdownMenu.Label>{user.email}</DropdownMenu.Label>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Label>Theme</DropdownMenu.Label>
                  <DropdownMenu.RadioGroup value={mode} onValueChange={(m) => setMode(m as ThemeMode)}>
                    <DropdownMenu.RadioItem value="light"><SunIcon /> Light</DropdownMenu.RadioItem>
                    <DropdownMenu.RadioItem value="dark"><MoonIcon /> Dark</DropdownMenu.RadioItem>
                    <DropdownMenu.RadioItem value="system"><DesktopIcon /> System</DropdownMenu.RadioItem>
                  </DropdownMenu.RadioGroup>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item color="red" onSelect={() => onLogout()}><ExitIcon /> Sign out</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </Box>
          </Flex>
        </nav>
      </Box>

      <Box flexGrow="1" minWidth="0" p={{ initial: "4", md: "6" }} pt={{ initial: "8", sm: "6" }}>
        {allowed.includes(role) ? children : (
          <Text color="gray">{ROLE_LABEL[role]} does not have access to this page.</Text>
        )}
      </Box>
    </Flex>
  );
}

