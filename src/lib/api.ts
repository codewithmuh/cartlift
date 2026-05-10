// Bandit API client — JWT auth, typed endpoints.

export const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE
    ? process.env.NEXT_PUBLIC_API_BASE
    : "http://localhost:8050";

const ACCESS = "bandit-access";
const REFRESH = "bandit-refresh";

export type Tokens = { access: string; refresh: string };

export function readTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  const access = window.localStorage.getItem(ACCESS);
  const refresh = window.localStorage.getItem(REFRESH);
  return access && refresh ? { access, refresh } : null;
}

export function writeTokens(t: Tokens) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS, t.access);
  window.localStorage.setItem(REFRESH, t.refresh);
  window.dispatchEvent(new Event("bandit-auth"));
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS);
  window.localStorage.removeItem(REFRESH);
  window.dispatchEvent(new Event("bandit-auth"));
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(`Request failed (${status})`);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, body, ...rest } = init;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (auth) {
    const t = readTokens();
    if (t) finalHeaders.Authorization = `Bearer ${t.access}`;
  }
  const r = await fetch(`${API_BASE}${path}`, { ...rest, headers: finalHeaders, body });
  const text = await r.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!r.ok) throw new ApiError(r.status, data);
  return data as T;
}

export type Me = {
  id: number;
  email: string;
  company: string;
  created_at: string;
  last_login: string | null;
};

export const auth = {
  signup: (email: string, password: string, company = "") =>
    api<{ access: string; refresh: string; user: Me }>("/api/auth/signup", {
      method: "POST", auth: false,
      body: JSON.stringify({ email, password, company }),
    }),
  login: (email: string, password: string) =>
    api<{ access: string; refresh: string; user: Me }>("/api/auth/login", {
      method: "POST", auth: false,
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<Me>("/api/auth/me"),
};

export type Site = {
  id: number;
  domain: string;
  label: string;
  token: string;
  sampling: number;
  created_at: string;
  updated_at: string;
};

export const sites = {
  list: () => api<{ results: Site[] } | Site[]>("/api/sites/"),
  create: (domain: string, label = "", sampling = 50) =>
    api<Site>("/api/sites/", { method: "POST", body: JSON.stringify({ domain, label, sampling }) }),
  remove: (id: number) => api<void>(`/api/sites/${id}/`, { method: "DELETE" }),
};

export type AuditType = "cro" | "seo" | "compliance" | "gmc";

export type Finding = {
  surface: string;
  severity: "high" | "medium" | "low";
  label: string;
  note: string;
  predicted_lift_pct: number;
};

export type ReportCheck = { item: string; ok: boolean; note?: string };
export type ReportSection = { title: string; finding: string; recommendations: string[] };
export type ReportMessage = { type: string; description: string; affected: number };

export type AuditReport = {
  checks?: ReportCheck[];
  sections?: ReportSection[];
  conclusion?: string[];
  messages?: ReportMessage[];
  areas?: ReportSection[];
};

export type Audit = {
  id: number;
  url: string;
  audit_type: AuditType;
  status: "queued" | "running" | "done" | "failed";
  page_title: string;
  summary: string;
  findings: Finding[];
  report: AuditReport;
  elapsed_ms: number;
  error: string;
  created_at: string;
  completed_at: string | null;
};

export const audits = {
  list: (type?: AuditType) =>
    api<{ results: Audit[] } | Audit[]>(
      type ? `/api/audits/?type=${type}` : "/api/audits/",
    ),
  get: (id: number) => api<Audit>(`/api/audits/${id}/`),
  run: (url: string, audit_type: AuditType = "cro") =>
    api<Audit>("/api/audits/", {
      method: "POST",
      body: JSON.stringify({ url, audit_type }),
    }),
  generateVariants: (auditId: number, siteId: number) =>
    api<{ created: number; experiments: Experiment[] }>(
      `/api/audits/${auditId}/generate_variants/`,
      { method: "POST", body: JSON.stringify({ site_id: siteId }) },
    ),
};

export type Variant = {
  id: number;
  name: string;
  is_control: boolean;
  body: string;
  rationale: string;
  samples: number;
  conversions: number;
  weight: number;
  conversion_rate: number;
  created_at: string;
};

export type Experiment = {
  id: number;
  site: number;
  site_domain: string;
  name: string;
  surface: string;
  selector: string;
  hypothesis: string;
  status: "draft" | "trial" | "winner" | "killed" | "paused";
  confidence: number;
  uplift_pct: number;
  started_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  variants: Variant[];
};

export const experiments = {
  list: () => api<{ results: Experiment[] } | Experiment[]>("/api/experiments/"),
  get: (id: number) => api<Experiment>(`/api/experiments/${id}/`),
  approve: (id: number) =>
    api<Experiment>(`/api/experiments/${id}/approve/`, { method: "POST" }),
  kill: (id: number) =>
    api<Experiment>(`/api/experiments/${id}/kill/`, { method: "POST" }),
  pause: (id: number) =>
    api<Experiment>(`/api/experiments/${id}/pause/`, { method: "POST" }),
};
