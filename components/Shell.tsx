"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Box, DropdownMenu, Flex, IconButton, Select, Separator, Text, Tooltip } from "@radix-ui/themes";
import {
  BarChartIcon, CalendarIcon, ChatBubbleIcon, ClockIcon, DashboardIcon, FileTextIcon, GearIcon,
  DesktopIcon, DoubleArrowLeftIcon, DoubleArrowRightIcon, HamburgerMenuIcon, HomeIcon, IdCardIcon, ListBulletIcon, MoonIcon, PersonIcon, SunIcon,
} from "@radix-ui/react-icons";
import { ROLE_LABEL, useRole } from "@/lib/client";
import { useThemeMode, type ThemeMode } from "./AppTheme";
import type { Role } from "@/lib/types";

const ALL: Role[] = ["super_admin", "coordinator", "client_admin"];
const NAV: { href: string; label: string; icon: React.ReactNode; roles: Role[]; soon?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: <DashboardIcon />, roles: ALL },
  { href: "/shifts", label: "Shifts", icon: <ListBulletIcon />, roles: ALL },
  { href: "/rota", label: "Rota", icon: <CalendarIcon />, roles: ALL },
  { href: "/attendance", label: "Attendance", icon: <ClockIcon />, roles: ALL },
  { href: "/timesheets", label: "Timesheets & Pay", icon: <FileTextIcon />, roles: ALL },
  { href: "/workers", label: "Workers", icon: <PersonIcon />, roles: ALL },
  { href: "/compliance", label: "Compliance", icon: <IdCardIcon />, roles: ["super_admin", "coordinator"] },
  { href: "/clients", label: "Clients & Sites", icon: <HomeIcon />, roles: ALL },
  { href: "/reports", label: "Reports", icon: <BarChartIcon />, roles: ALL },
  { href: "/leave", label: "Leave", icon: <SunIcon />, roles: ALL, soon: true },
  { href: "/messages", label: "Messages", icon: <ChatBubbleIcon />, roles: ["super_admin", "coordinator"], soon: true },
  { href: "/settings", label: "Settings & Audit", icon: <GearIcon />, roles: ["super_admin"] },
];

const THEME_ICON: Record<ThemeMode, React.ReactNode> = { light: <SunIcon />, dark: <MoonIcon />, system: <DesktopIcon /> };

const USER: Record<Role, string> = { super_admin: "Priya Shah", coordinator: "Tom Reed", client_admin: "Helen Ward · Oakwood Care" };

export function Shell({ children }: { children: React.ReactNode }) {
  const { role, setRole } = useRole();
  const path = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop icon-only rail
  const { mode, setMode } = useThemeMode();

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sidebar") === "collapsed"); } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    try { localStorage.setItem("sidebar", collapsed ? "expanded" : "collapsed"); } catch {}
  };
  const allowed = NAV.find((n) => n.href !== "/" && path.startsWith(n.href))?.roles ?? ALL;

  return (
    <Flex minHeight="100vh">
      <Box asChild className={`sidebar${open ? " open" : ""}${collapsed ? " collapsed" : ""}`}>
        <nav onClick={() => setOpen(false)}>
          <Flex direction="column" gap="1" p="3">
            <Flex align="center" justify="between" mb="3" className="brand">
              <Text size="3" weight="bold" ml="2" className="label">Staffing Admin</Text>
              <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                <IconButton variant="ghost" color="gray" className="collapse-btn" onClick={(e) => { e.stopPropagation(); toggleCollapsed(); }} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                  {collapsed ? <DoubleArrowRightIcon /> : <DoubleArrowLeftIcon />}
                </IconButton>
              </Tooltip>
            </Flex>
            {NAV.filter((n) => n.roles.includes(role)).map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              const link = (
                <Link key={n.href} href={n.href} className={`navlink${active ? " active" : ""}`} aria-label={n.label}>
                  {n.icon}
                  <span className="label" style={{ flex: 1 }}>{n.label}</span>
                  {n.soon && <Badge size="1" color="gray" className="label">P2</Badge>}
                </Link>
              );
              return collapsed ? <Tooltip key={n.href} content={n.label} side="right">{link}</Tooltip> : link;
            })}
          </Flex>
        </nav>
      </Box>

      <Flex direction="column" flexGrow="1" minWidth="0">
        <Flex align="center" justify="between" gap="3" px="4" py="3" className="topbar">
          <Flex align="center" gap="2">
            <IconButton variant="ghost" className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menu"><HamburgerMenuIcon /></IconButton>
            <Text size="2" color="gray">Signed in as <Text weight="medium" color="gray" highContrast>{USER[role]}</Text></Text>
          </Flex>
          <Flex align="center" gap="3">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton variant="ghost" color="gray" aria-label="Theme">{THEME_ICON[mode]}</IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.RadioGroup value={mode} onValueChange={(m) => setMode(m as ThemeMode)}>
                  <DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
                  <DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
                  <DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <Text size="1" color="gray">View as</Text>
            <Select.Root value={role} onValueChange={(r) => setRole(r as Role)} size="1">
              <Select.Trigger />
              <Select.Content>
                {ALL.map((r) => <Select.Item key={r} value={r}>{ROLE_LABEL[r]}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>
        <Separator size="4" />
        <Box p={{ initial: "4", md: "6" }} style={{ maxWidth: 1280, width: "100%" }}>
          {allowed.includes(role) ? children : (
            <Text color="gray">{ROLE_LABEL[role]} does not have access to this page.</Text>
          )}
        </Box>
      </Flex>
    </Flex>
  );
}
