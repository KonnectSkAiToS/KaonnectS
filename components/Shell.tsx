"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Box, DropdownMenu, Flex, IconButton, Text, Tooltip } from "@radix-ui/themes";
import {
  BarChartIcon, CalendarIcon, ChatBubbleIcon, ClockIcon, DashboardIcon, FileTextIcon, GearIcon,
  DesktopIcon, DoubleArrowLeftIcon, DoubleArrowRightIcon, HamburgerMenuIcon, HomeIcon, IdCardIcon, ListBulletIcon, MoonIcon, PersonIcon, SunIcon,
} from "@radix-ui/react-icons";
import { ROLE_LABEL, useRole } from "@/lib/client";
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
  { href: "/settings", label: "Settings & Audit", icon: <GearIcon />, roles: ["super_admin"] },
];

const THEME_ICON: Record<ThemeMode, React.ReactNode> = { light: <SunIcon />, dark: <MoonIcon />, system: <DesktopIcon /> };

const USER: Record<Role, { name: string; org?: string }> = {
  super_admin: { name: "Priya Shah" },
  coordinator: { name: "Tom Reed" },
  client_admin: { name: "Helen Ward", org: "Oakwood Care" },
};

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
      <IconButton variant="surface" color="gray" className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><HamburgerMenuIcon /></IconButton>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <Box asChild className={`sidebar${open ? " open" : ""}${collapsed ? " collapsed" : ""}`}>
        <nav>
          <Flex direction="column" gap="1" p="3" height="100%">
            <Flex align="center" justify="between" mb="3" className="brand">
              <Text size="3" weight="bold" ml="2" className="label">Staffing Admin</Text>
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
                  <button className="navlink profile" aria-label="Account, role and theme">
                    <Avatar size="2" radius="full" fallback={USER[role].name.split(" ").map((p) => p[0]).join("")} />
                    <span className="label" style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <Text as="div" size="2" weight="medium" truncate>{USER[role].name}</Text>
                      <Text as="div" size="1" color="gray" truncate>{ROLE_LABEL[role]}{USER[role].org && ` · ${USER[role].org}`}</Text>
                    </span>
                    <span className="label">{THEME_ICON[mode]}</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content side="top" align="start" style={{ minWidth: 220 }}>
                  <DropdownMenu.Label>View as (demo)</DropdownMenu.Label>
                  <DropdownMenu.RadioGroup value={role} onValueChange={(r) => setRole(r as Role)}>
                    {ALL.map((r) => <DropdownMenu.RadioItem key={r} value={r}>{ROLE_LABEL[r]}</DropdownMenu.RadioItem>)}
                  </DropdownMenu.RadioGroup>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Label>Theme</DropdownMenu.Label>
                  <DropdownMenu.RadioGroup value={mode} onValueChange={(m) => setMode(m as ThemeMode)}>
                    <DropdownMenu.RadioItem value="light"><SunIcon /> Light</DropdownMenu.RadioItem>
                    <DropdownMenu.RadioItem value="dark"><MoonIcon /> Dark</DropdownMenu.RadioItem>
                    <DropdownMenu.RadioItem value="system"><DesktopIcon /> System</DropdownMenu.RadioItem>
                  </DropdownMenu.RadioGroup>
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
