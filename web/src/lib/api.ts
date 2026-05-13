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

export type LlmProvider = "anthropic" | "openai";

export type Me = {
  id: number;
  email: string;
  company: string;
  created_at: string;
  last_login: string | null;
  llm_provider: LlmProvider;
  llm_model: string;
  has_anthropic_key: boolean;
  anthropic_key_preview: string;
  has_openai_key: boolean;
  openai_key_preview: string;
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

export type CrawledPage = {
  label: string;
  labels?: string[];
  url: string;
  title: string;
};

// SEO-specific extensions to the audit report.
export type SeoScores = {
  technical: number;
  content: number;
  structured_data: number;
  performance: number;
  overall: number;
};

export type SeoKeyword = { term: string; count: number; density_pct: number };
export type SeoHreflang = { lang: string; href: string };

export type SeoPage = {
  url: string;
  status: number;
  response_ms: number;
  byte_size: number;
  redirected?: boolean;
  title: string;
  title_length: number;
  title_pixel_width?: number;
  meta_description: string;
  meta_description_length: number;
  meta_description_pixel_width?: number;
  canonical: string;
  canonical_is_self: boolean;
  robots: string;
  indexable: boolean;
  lang: string;
  viewport: string;
  doctype?: string;
  charset?: string;
  favicon?: string;
  apple_touch_icon?: string;
  h1_count: number;
  h1: string;
  h2_count?: number;
  h2?: string[];
  h3_count?: number;
  word_count: number;
  sentence_count?: number;
  avg_sentence_length?: number;
  stop_word_pct?: number;
  paragraph_count?: number;
  strong_bold_count?: number;
  img_total: number;
  img_with_alt: number;
  img_alt_pct: number;
  internal_links: number;
  external_links: number;
  schema_types: string[];
  og: { title: string; description: string; image: string; url: string; type: string };
  twitter: { card: string; title: string; description: string; image: string };
  hreflangs?: SeoHreflang[];
  js_files?: number;
  css_files?: number;
  inline_scripts?: number;
  compression?: string;
  server?: string;
  x_powered_by?: string;
  last_modified?: string;
  url_param_count?: number;
  url_has_session_id?: boolean;
  url_depth?: number;
  keywords?: SeoKeyword[];
  error?: string;
};

export type SeoSearchPreview = {
  url: string;
  host: string;
  title: string;
  title_pixel_width: number;
  title_truncated: boolean;
  description: string;
  description_pixel_width: number;
  description_truncated: boolean;
  favicon?: string;
};

export type SeoContentStats = {
  avg_word_count: number;
  avg_paragraph_count: number;
  avg_sentence_length: number;
  avg_stop_word_pct: number;
  avg_response_ms: number;
  avg_byte_size: number;
  avg_internal_links: number;
  total_schemas_found: number;
  unique_schema_types: string[];
};

export type SeoSiteDiagnostics = {
  https: boolean;
  origin: string;
  robots_txt: { present: boolean; url: string; sitemaps?: string[]; disallow_count?: number; byte_size?: number };
  sitemap_xml: { present: boolean; url: string; url_count?: number; sample?: string[] };
  www_canonicalization?: { checked: boolean; variants?: Record<string, string>; unified?: boolean };
  duplicate_titles: { title: string; urls: string[] }[];
  duplicate_metas: { meta: string; urls: string[] }[];
  pages_missing_meta: string[];
  pages_missing_h1: string[];
  pages_missing_canonical: string[];
  pages_multi_h1: string[];
  pages_thin: string[];
  pages_no_og_image: string[];
  pages_no_schema: string[];
  pages_4xx: string[];
  pages_5xx: string[];
  slow_pages: string[];
  pages_no_favicon?: string[];
  pages_no_charset?: string[];
  pages_no_doctype?: string[];
  pages_no_compression?: string[];
  pages_with_session_id?: string[];
  pages_with_redirects?: string[];
  pages_long_title?: string[];
  pages_long_meta?: string[];
  pages_short_meta?: string[];
  pages_high_stop_word_density?: string[];
};

export type SeoOpportunity = {
  title: string;
  severity: "high" | "medium" | "low";
  surface: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  note: string;
};

export type AuditReport = {
  checks?: ReportCheck[];
  sections?: ReportSection[];
  conclusion?: string[];
  areas?: ReportSection[];
  ai_analysis?: boolean;          // gmc — true when LLM cross-page analysis ran
  crawled?: CrawledPage[];        // compliance + gmc — light label info per page
  // SEO-only extensions
  pages?: SeoPage[];              // SEO — full per-page snapshot
  scores?: SeoScores;
  site?: SeoSiteDiagnostics;
  opportunities?: SeoOpportunity[];
  search_preview?: SeoSearchPreview;
  top_keywords?: SeoKeyword[];
  content_stats?: SeoContentStats;
};

export type Audit = {
  id: number;
  slug: string;
  is_public: boolean;
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

// Public audit endpoints — no JWT required. Powers the /audit/<slug> share pages.
export const publicAudits = {
  run: (url: string) =>
    api<Audit>("/api/public/audits/", {
      method: "POST", auth: false,
      body: JSON.stringify({ url }),
    }),
  get: (slug: string) =>
    api<Audit>(`/api/public/audits/${slug}/`, { auth: false }),
  claim: (slug: string) =>
    api<Audit>(`/api/public/audits/${slug}/claim/`, { method: "POST" }),
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
