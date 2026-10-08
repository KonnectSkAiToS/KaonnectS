"use client";
// The one global store for app-wide client state: session, UI preferences and the reload counter.
// Server data lives in TanStack Query (lib/client.tsx); this store only holds state the app owns.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Theme } from "@radix-ui/themes";
import type { Role } from "./types";

export type ThemeMode = "light" | "dark" | "system";
export type SessionStatus = "loading" | "signed-in" | "signed-out";
export interface SessionUser { id: string; name: string; email: string; role: Role; clientIds: string[] | null }
export interface Brand { name: string; brandColor: React.ComponentProps<typeof Theme>["accentColor"] }

interface AppState {
  // Session (set by the auth bootstrap in lib/client.tsx; never persisted — the refresh cookie is the source of truth)
  user: SessionUser | null;
  status: SessionStatus;
  setSession: (user: SessionUser | null) => void;

  // White-label branding for the signed-in agency (null until loaded; the server-rendered value is the fallback)
  brand: Brand | null;
  setBrand: (b: Brand) => void;

  // UI preferences (persisted per browser)
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Part of every query key: bumping it makes every query on the page fetch again.
  reloadCount: number;
  reload: () => void;
}

export const STORE_KEY = "staffing-ui";

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      status: "loading",
      setSession: (user) => set({ user, status: user ? "signed-in" : "signed-out" }),

      brand: null,
      setBrand: (brand) => set({ brand }),

      themeMode: "system",
      setThemeMode: (themeMode) => set({ themeMode }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      reloadCount: 0,
      reload: () => set((s) => ({ reloadCount: s.reloadCount + 1 })),
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ themeMode: s.themeMode, sidebarCollapsed: s.sidebarCollapsed }),
      skipHydration: true, // rehydrated on the client after mount, so server and first client render match
    },
  ),
);
