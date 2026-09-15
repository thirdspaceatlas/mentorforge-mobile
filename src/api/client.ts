// Shared-backend client: attaches the Supabase access token to every call.
// The shared backend is the EXTERNAL Next.js app (mentorforge.co).
//
// Base-URL resolution (per mentorforge-mobile / EAS contract):
//   1. EXPO_PUBLIC_API_URL        — primary (set in EAS)
//   2. EXPO_PUBLIC_SHARED_API_URL — fallback
//   3. EXPO_PUBLIC_BACKEND_URL    — fallback (platform-managed; often the proxy)
//   4. https://www.mentorforge.co — hard default
// Any candidate that points at the Emergent/Metro preview proxy is skipped —
// that host serves the bundler only and must NEVER receive /api/... calls.
import { supabase } from "@/src/lib/supabase";

const PROXY_HOST_RE = /(emergentagent\.com|emergentcf\.cloud|preview\.)/i;

function isUsable(url?: string | null): url is string {
  if (!url) return false;
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return false;
  return !PROXY_HOST_RE.test(u);
}

function resolveBase(): string {
  const candidates = [
    process.env.EXPO_PUBLIC_API_URL,
    process.env.EXPO_PUBLIC_SHARED_API_URL,
    process.env.EXPO_PUBLIC_BACKEND_URL,
  ];
  for (const c of candidates) {
    if (isUsable(c)) return c.trim().replace(/\/+$/, "");
  }
  return "https://www.mentorforge.co";
}

const BASE = resolveBase();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown };

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let d: any = null;
  if (text) {
    try {
      d = JSON.parse(text);
    } catch {
      d = { detail: text };
    }
  }
  if (!res.ok) {
    const m = d?.detail || d?.error || d?.message || `Request failed (${res.status})`;
    throw new ApiError(typeof m === "string" ? m : "Request failed", res.status);
  }
  return d as T;
}
