"use client";
import { useCallback, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useAppStore, type SessionUser } from "./store";
import type { Role } from "./types";

export type { SessionUser } from "./store";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  coordinator: "Coordinator",
  client_admin: "Client Admin",
};

// ---------- Session ----------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";
const WEB_API = `${API_URL}/web/v1`;

/** Pages already served by the real API. Everything else still uses the in-app dummy API until migrated. */
const MIGRATED = [
  /^\/dashboard(?:[/?]|$)/,
  /^\/workers(?:[/?]|$)/,
  /^\/clients(?:[/?]|$)/,
  /^\/sites(?:[/?]|$)/,
  /^\/shifts(?:[/?]|$)/,
  /^\/attendance(?:[/?]|$)/,
  /^\/timesheets(?:[/?]|$)/,
  /^\/ratecards(?:[/?]|$)/,
  /^\/payroll(?:[/?]|$)/,
  /^\/roles(?:[/?]|$)/,
  /^\/config\//,
  /^\/documents(?:[/?]|$)/,
  /^\/leave(?:[/?]|$)/,
  /^\/conversations(?:[/?]|$)/,
  /^\/reports(?:[/?]|$)/,
  /^\/invoices(?:[/?]|$)/,
];

/**
 * Prefix a path with "dummy:" to force the in-app dummy API even when the path is migrated.
 * Used by not-yet-migrated pages whose IDs must match the dummy data (e.g. worker pickers on Leave).
 * ponytail: remove each usage when that page migrates; delete this once MIGRATED covers everything.
 */
const DUMMY_PREFIX = "dummy:";

// The access token lives only in memory; the refresh token is an httpOnly cookie the API sets.
let accessToken: string | null = null;
let refreshing: Promise<SessionUser | null | "retry"> | null = null;

/**
 * Server data cache. Every useApi query is keyed ["api", userId, path, reloadCount]; saves invalidate it
 * and sign-out clears it, so one user's data is never shown to another.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // revisiting a page within 30s shows cached data without refetching
      refetchOnWindowFocus: false,
      retry: (count, e) => (e as ApiError).status >= 500 && count < 1,
    },
  },
});

function endSession() {
  accessToken = null;
  queryClient.clear();
  useAppStore.getState().setSession(null);
}

/**
 * Exchanges the refresh cookie for a new access token.
 * Returns the user, null when the session is really over (401), or "retry" when the server is busy
 * or unreachable (429 / network) — that must not sign the user out.
 */
async function refreshSession(): Promise<SessionUser | null | "retry"> {
  // Several requests can hit a 401 at once; they share one refresh.
  refreshing ??= fetch(`${WEB_API}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (r) => {
      if (r.status === 401) return null;
      if (!r.ok) return "retry" as const;
      const d = await r.json();
      accessToken = d.accessToken;
      return d.user as SessionUser;
    })
    .catch(() => "retry" as const)
    .finally(() => { refreshing = null; });
  return refreshing;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Refresh with a few back-off retries for transient failures. */
async function refreshWithRetry(): Promise<SessionUser | null | "retry"> {
  for (const wait of [0, 2000, 5000, 10000]) {
    if (wait) await sleep(wait);
    const r = await refreshSession();
    if (r !== "retry") return r;
  }
  return "retry";
}

/** Session state from the global store plus sign-in / sign-out. */
export function useAuth() {
  const user = useAppStore((st) => st.user);
  const status = useAppStore((st) => st.status);
  return { user, status, login, logout };
}

/** Current user's role. Pages only render once signed in; the fallback is the least-privileged role. */
export const useRole = () => ({ role: useAppStore((st) => st.user?.role) ?? ("client_admin" as Role) });

async function login(tenant: string, email: string, password: string) {
  const res = await fetch(`${WEB_API}/auth/login`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant, email, password }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(d.error ?? "Sign-in failed", res.status, d.reasons);
  accessToken = d.accessToken;
  queryClient.clear();
  useAppStore.getState().setSession(d.user);
}

async function logout() {
  await fetch(`${WEB_API}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  endSession();
}

/** App-wide providers: TanStack Query, store rehydration and the session bootstrap. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useAppStore.persist.rehydrate(); // theme + sidebar from localStorage, after the first render
    refreshWithRetry().then((u) => {
      // Still unreachable after retries: send to login, which shows a clear error if sign-in also fails.
      useAppStore.getState().setSession(u === "retry" ? null : u);
    });
  }, []);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public reasons: string[] = []) {
    super(message);
  }
}

async function realApi<T>(path: string, init?: { method?: string; body?: unknown }, retry = true): Promise<T> {
  const res = await fetch(`${WEB_API}${path}`, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 401) {
    const r = retry ? await refreshWithRetry() : null;
    if (r && r !== "retry") return realApi<T>(path, init, false);
    if (r === "retry") throw new ApiError("Can't reach the server right now. Try again in a moment.", 503);
    endSession();
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Request failed", res.status, data.reasons);
  return data as T;
}

/**
 * Download a file (e.g. a CSV export) as the signed-in user and save it with `filename`.
 * Goes to the real API for migrated paths (with the access token, refreshing once on 401), else the dummy API.
 */
export async function downloadFile(role: Role, path: string, filename: string) {
  const real = MIGRATED.some((r) => r.test(path));
  const get = () => real
    ? fetch(`${WEB_API}${path}`, { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} })
    : fetch(`/api${path}`, { headers: { "x-role": role } });
  let res = await get();
  if (real && res.status === 401 && (await refreshWithRetry()) && accessToken) res = await get();
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(d.error ?? "Download failed", res.status, d.reasons);
  }
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

// Single place that talks to the API: migrated paths go to the real API, the rest to the dummy one.
export async function api<T>(role: Role, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (path.startsWith(DUMMY_PREFIX)) path = path.slice(DUMMY_PREFIX.length);
  else if (MIGRATED.some((r) => r.test(path))) return realApi<T>(path, init);
  // ponytail: dummy API still trusts an x-role header; it goes away as each page migrates.
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", "x-role": role },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error ?? "Request failed", res.status, data.reasons);
  return data as T;
}

/**
 * Fetch `path` for the current page. Built on TanStack Query: the key includes the global reloadCount,
 * so the Reload button (which bumps it) refetches every query on the page. While a reload is in flight
 * the previous data stays on screen; a different path starts empty so another record never flashes.
 */
export function useApi<T>(path: string | null) {
  const user = useAppStore((st) => st.user);
  const reloadCount = useAppStore((st) => st.reloadCount);
  const q = useQuery<T, ApiError>({
    queryKey: ["api", user?.id, path, reloadCount],
    queryFn: () => api<T>(user!.role, path!),
    enabled: !!path && !!user,
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === path ? prev : undefined),
  });
  const reload = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["api", user?.id, path] }),
    [user?.id, path],
  );
  return { data: q.data, error: q.error ?? undefined, reload };
}

/** Returns a function that sends a mutation. Any successful save marks every cached query stale. */
export function useSend() {
  const { role } = useRole();
  return useCallback(
    async <T,>(path: string, method: string, body?: unknown) => {
      const res = await api<T>(role, path, { method, body });
      await queryClient.invalidateQueries({ queryKey: ["api"] });
      return res;
    },
    [role],
  );
}

// The agency works in UK time: shift times show as Europe/London whatever the viewer's zone.
export const TZ = "Europe/London";
// Calendar dates ("2026-10-10", optionally "T00:00") are days, not instants: show them as written.
const CALENDAR_DATE = /^(\d{4}-\d{2}-\d{2})(?:T00:00(?::00)?)?$/;
export const fmtDate = (iso: string) => {
  const day = CALENDAR_DATE.exec(iso)?.[1];
  return day
    ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short" })
    : new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" });
};
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** YYYY-MM-DD of an instant in UK time (for grouping shifts by day). */
export const ukDate = (iso: string | Date) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
/** Adds days to a YYYY-MM-DD date. */
export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Monday (YYYY-MM-DD) of the UK week containing `day`. */
export const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
/** UTC instant (ISO) of 00:00 UK time on `day` — for API date-range filters. */
export const ukMidnight = (day: string) => {
  const guess = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(guess).map((x) => [x.type, x.value]));
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (shown - guess)).toISOString();
};
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const fmtMoney = (n?: number) => (n === undefined ? "—" : n.toLocaleString("en-GB", { style: "currency", currency: "GBP" }));
export const fmtHours = (h: number) => `${Math.round(h * 100) / 100}h`;

/** Configured job roles. `forSector` keeps active roles offered for that client sector (plus "any"). */
export function useRoles() {
  const { data, error, reload } = useApi<import("./types").JobRole[]>("/roles");
  const forSector = (sector?: string) =>
    (data ?? []).filter((r) => r.active && (!sector || r.sector === "any" || r.sector === sector)).map((r) => r.name);
  return { roles: data, error, reload, forSector };
}

// ---------- Configuration ----------

export interface SettingDef {
  key: string; module: string; label: string; help: string; type: "number" | "time";
  default: number | string; min?: number; max?: number; step?: number; unit?: string; value: number | string;
}
export interface DocumentTypeConfig {
  id: string; name: string; description: string | null; hasExpiry: boolean; requiredForAll: boolean; active: boolean;
  usage: { roles: number; sites: number; documents: number };
}
export interface LeaveTypeConfig {
  id: string; name: string; color: string; paid: boolean; countsAgainstHoliday: boolean; blocksBooking: boolean;
  active: boolean; sortOrder: number; usage: { requests: number };
}

/** Agency settings (Configuration). `get(key)` falls back to the given default while loading. */
export function useSettings() {
  const { data, error, reload } = useApi<SettingDef[]>("/config/settings");
  const get = <T extends number | string>(key: string, fallback: T): T => (data?.find((s) => s.key === key)?.value as T) ?? fallback;
  return { settings: data, error, reload, get };
}

export function useDocumentTypes() {
  const { data, error, reload } = useApi<DocumentTypeConfig[]>("/config/document-types");
  return { docTypes: data, error, reload, active: (data ?? []).filter((d) => d.active) };
}

export function useLeaveTypes() {
  const { data, error, reload } = useApi<LeaveTypeConfig[]>("/config/leave-types");
  const byName = (name: string) => data?.find((t) => t.name === name);
  return { leaveTypes: data, error, reload, active: (data ?? []).filter((t) => t.active), byName, color: (name: string) => byName(name)?.color ?? "gray" };
}
