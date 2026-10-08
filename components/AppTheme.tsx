"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Theme } from "@radix-ui/themes";
import { api } from "@/lib/client";
import { STORE_KEY, useAppStore, type Brand, type ThemeMode } from "@/lib/store";

export type { Brand, ThemeMode } from "@/lib/store";

// Only carries the server-rendered branding, used until the store has its own copy.
const InitialBrand = createContext<Brand>({ name: "", brandColor: "indigo" });

/** Theme mode + branding from the global store, with sign-in-free fallbacks for the first render. */
export function useThemeMode() {
  const initial = useContext(InitialBrand);
  const mode = useAppStore((s) => s.themeMode);
  const setMode = useAppStore((s) => s.setThemeMode);
  const brand = useAppStore((s) => s.brand) ?? initial;
  const reloadBrand = useCallback(() => {
    api<Brand>(useAppStore.getState().user?.role ?? "client_admin", "/tenant")
      .then((t) => useAppStore.getState().setBrand({ name: t.name, brandColor: t.brandColor }))
      .catch(() => {});
  }, []);
  return { mode, setMode, brand, reloadBrand };
}

/**
 * Runs before first paint (inlined in <head>) so a saved dark theme never flashes light.
 * Reads the persisted global store. Radix Themes with appearance="inherit" follows the class on <html>.
 */
export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORE_KEY)})||"{}").state||{};var m=s.themeMode||"system";var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var h=document.documentElement;h.classList.remove("light","dark");h.classList.add(d?"dark":"light");h.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

function applyAppearance(dark: boolean) {
  const h = document.documentElement;
  h.classList.remove("light", "dark");
  h.classList.add(dark ? "dark" : "light");
  h.style.colorScheme = dark ? "dark" : "light";
}

export function AppTheme({ initialBrand, children }: { initialBrand: Brand; children: React.ReactNode }) {
  const mode = useAppStore((s) => s.themeMode);
  const brand = useAppStore((s) => s.brand) ?? initialBrand;
  const [systemDark, setSystemDark] = useState(false);
  // Don't touch <html> until the saved mode is loaded, or a saved dark theme would flip to light.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const done = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => { done(); mq.removeEventListener("change", on); };
  }, []);

  useEffect(() => {
    if (hydrated) applyAppearance(mode === "dark" || (mode === "system" && systemDark));
  }, [hydrated, mode, systemDark]);

  return (
    <InitialBrand.Provider value={initialBrand}>
      <Theme appearance="inherit" accentColor={brand.brandColor} grayColor="slate" radius="medium">{children}</Theme>
    </InitialBrand.Provider>
  );
}
