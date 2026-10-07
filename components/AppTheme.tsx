"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Theme } from "@radix-ui/themes";

export type ThemeMode = "light" | "dark" | "system";
type Accent = React.ComponentProps<typeof Theme>["accentColor"];
export interface Brand { name: string; brandColor: Accent }

const Ctx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void; brand: Brand; reloadBrand: () => void }>({
  mode: "system", setMode: () => {}, brand: { name: "", brandColor: "indigo" }, reloadBrand: () => {},
});
export const useThemeMode = () => useContext(Ctx);

/**
 * Runs before first paint (inlined in <head>) so a saved dark theme never flashes light.
 * Radix Themes with appearance="inherit" follows the `dark` / `light` class on <html>.
 */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("theme")||"system";var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var h=document.documentElement;h.classList.remove("light","dark");h.classList.add(d?"dark":"light");h.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

function applyAppearance(dark: boolean) {
  const h = document.documentElement;
  h.classList.remove("light", "dark");
  h.classList.add(dark ? "dark" : "light");
  h.style.colorScheme = dark ? "dark" : "light";
}

export function AppTheme({ initialBrand, children }: { initialBrand: Brand; children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false); // don't touch <html> until the saved mode is known
  const [brand, setBrand] = useState<Brand>(initialBrand);

  // White-label: name and accent colour come from the tenant record (server-rendered first, refetched after edits).
  const reloadBrand = useCallback(() => {
    fetch("/api/tenant").then((r) => r.json()).then((t) => setBrand({ name: t.name, brandColor: t.brandColor })).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as ThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
    } catch {}
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    setReady(true);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (ready) applyAppearance(mode === "dark" || (mode === "system" && systemDark));
  }, [ready, mode, systemDark]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem("theme", m); } catch {}
  };

  return (
    <Ctx.Provider value={{ mode, setMode, brand, reloadBrand }}>
      <Theme appearance="inherit" accentColor={brand.brandColor} grayColor="slate" radius="medium">{children}</Theme>
    </Ctx.Provider>
  );
}
