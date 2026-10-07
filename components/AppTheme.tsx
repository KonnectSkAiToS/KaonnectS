"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Theme } from "@radix-ui/themes";

export type ThemeMode = "light" | "dark" | "system";
const Ctx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({ mode: "system", setMode: () => {} });
export const useThemeMode = () => useContext(Ctx);

export function AppTheme({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as ThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
    } catch {}
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem("theme", m); } catch {}
  };
  const appearance = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  return (
    <Ctx.Provider value={{ mode, setMode }}>
      <Theme appearance={appearance} accentColor="indigo" grayColor="slate" radius="medium">{children}</Theme>
    </Ctx.Provider>
  );
}
