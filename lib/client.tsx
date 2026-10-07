"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  coordinator: "Coordinator",
  client_admin: "Client Admin",
};

const RoleCtx = createContext<{ role: Role; setRole: (r: Role) => void }>({ role: "super_admin", setRole: () => {} });
export const useRole = () => useContext(RoleCtx);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("super_admin");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("role") as Role | null;
      if (saved && saved in ROLE_LABEL) setRoleState(saved);
    } catch {}
  }, []);
  const setRole = (r: Role) => {
    setRoleState(r);
    try { localStorage.setItem("role", r); } catch {}
  };
  return <RoleCtx.Provider value={{ role, setRole }}>{children}</RoleCtx.Provider>;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public reasons: string[] = []) {
    super(message);
  }
}

// Single place that talks to the API. Point this at the real backend later.
export async function api<T>(role: Role, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", "x-role": role },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error ?? "Request failed", res.status, data.reasons);
  return data as T;
}

export function useApi<T>(path: string | null) {
  const { role } = useRole();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setError(undefined);
    api<T>(role, path)
      .then((d) => live && setData(d))
      .catch((e) => live && (setError(e), setData(undefined)));
    return () => { live = false; };
  }, [path, role, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

/** Returns a function that sends a mutation with the current role. */
export function useSend() {
  const { role } = useRole();
  return useCallback(
    <T,>(path: string, method: string, body?: unknown) => api<T>(role, path, { method, body }),
    [role],
  );
}

// ponytail: browser-local time; pin to Europe/London once the backend stores UTC with a site timezone.
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const fmtMoney = (n?: number) => (n === undefined ? "—" : n.toLocaleString("en-GB", { style: "currency", currency: "GBP" }));
export const fmtHours = (h: number) => `${Math.round(h * 100) / 100}h`;
