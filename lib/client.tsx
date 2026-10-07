"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Role } from "./types";

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
];

/**
 * Prefix a path with "dummy:" to force the in-app dummy API even when the path is migrated.
 * Used by not-yet-migrated pages whose IDs must match the dummy data (e.g. worker pickers on Leave).
 * ponytail: remove each usage when that page migrates; delete this once MIGRATED covers everything.
 */
const DUMMY_PREFIX = "dummy:";

export interface SessionUser { id: string; name: string; email: string; role: Role; clientIds: string[] | null }

// The access token lives only in memory; the refresh token is an httpOnly cookie the API sets.
let accessToken: string | null = null;
let refreshing: Promise<SessionUser | null | "retry"> | null = null;
let onExpired: () => void = () => {};

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

type Status = "loading" | "signed-in" | "signed-out";
const AuthCtx = createContext<{
  user: SessionUser | null;
  status: Status;
  login: (tenant: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}>({ user: null, status: "loading", login: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(AuthCtx);

/** Current user's role. Pages only render once signed in; the fallback is the least-privileged role. */
export const useRole = () => ({ role: useContext(AuthCtx).user?.role ?? ("client_admin" as Role) });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    onExpired = () => { accessToken = null; cache.clear(); setUser(null); setStatus("signed-out"); };
    refreshWithRetry().then((u) => {
      // Still unreachable after retries: send to login, which shows a clear error if sign-in also fails.
      const user = u === "retry" ? null : u;
      setUser(user);
      setStatus(user ? "signed-in" : "signed-out");
    });
  }, []);

  const login = useCallback(async (tenant: string, email: string, password: string) => {
    const res = await fetch(`${WEB_API}/auth/login`, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant, email, password }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(d.error ?? "Sign-in failed", res.status, d.reasons);
    accessToken = d.accessToken;
    setUser(d.user);
    setStatus("signed-in");
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${WEB_API}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    onExpired();
  }, []);

  return <AuthCtx.Provider value={{ user, status, login, logout }}>{children}</AuthCtx.Provider>;
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
    onExpired();
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Request failed", res.status, data.reasons);
  return data as T;
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

// In-memory response cache: revisiting a page shows its last data instantly while it refreshes.
// Keyed by user so switching accounts never shows someone else's data. Cleared after any save and on sign-out.
// ponytail: unbounded Map, fine for one session; add LRU eviction if memory ever matters.
const cache = new Map<string, unknown>();

export function useApi<T>(path: string | null) {
  const { user } = useAuth();
  const role = user?.role;
  const key = path && user ? `${user.id}:${path}` : null;
  const [data, setData] = useState<T | undefined>(() => (key ? (cache.get(key) as T | undefined) : undefined));
  const [error, setError] = useState<ApiError>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path || !role || !key) return;
    let live = true;
    setError(undefined);
    if (cache.has(key)) setData(cache.get(key) as T); // stale-while-revalidate
    api<T>(role, path)
      .then((d) => { cache.set(key, d); if (live) setData(d); })
      .catch((e) => live && (setError(e), setData(undefined)));
    return () => { live = false; };
  }, [path, role, key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

/** Returns a function that sends a mutation with the current role. */
export function useSend() {
  const { role } = useRole();
  return useCallback(
    async <T,>(path: string, method: string, body?: unknown) => {
      const res = await api<T>(role, path, { method, body });
      cache.clear(); // a save can change any list, so nothing cached is trusted afterwards
      return res;
    },
    [role],
  );
}

// ponytail: browser-local time; pin to Europe/London once the backend stores UTC with a site timezone.
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const fmtMoney = (n?: number) => (n === undefined ? "—" : n.toLocaleString("en-GB", { style: "currency", currency: "GBP" }));
export const fmtHours = (h: number) => `${Math.round(h * 100) / 100}h`;
