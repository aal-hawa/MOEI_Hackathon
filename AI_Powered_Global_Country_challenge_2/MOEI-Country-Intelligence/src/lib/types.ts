/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Core Type Definitions
   ─────────────────────────────────────────────────────────────── */

// ── Language ────────────────────────────────────────────────────
export type Language = 'en' | 'ar';

// ── Country Dossier ────────────────────────────────────────────
export interface CountryField {
  country_iso: string;
  field_name: string;
  domain: string;
  value: string | null;
  value_num: number | null;
  unit: string | null;
  source_name: string | null;
  source_url: string | null;
  as_of_date: string | null;
  tier: number | null;
  confidence: string;
  corroborated: number;
  change_type: string;
}

export interface DossierResponse {
  iso3: string;
  fields: CountryField[];
}

// ── KPI ────────────────────────────────────────────────────────
export interface KPI {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'flat';
  source?: string;
  as_of?: string;
  color?: string;
}

// ── Dashboard Spec (from backend) ──────────────────────────────
export interface DashboardSpec {
  dashboard_title: string;
  country: string;
  kpis: Array<{ title: string; value: string; source_field: string }>;
  charts: Array<{
    title: string;
    chart_type: string;
    source_fields: string[];
    purpose: string;
    interaction: string;
  }>;
  insight_panels: Array<{ title: string; content: string; source_field: string }>;
  risk_panels: Array<{ title: string; content: string; source_field: string }>;
  opportunity_panels: Array<{ title: string; content: string; source_field: string }>;
}

// ── Dashboard Data (from backend) ──────────────────────────────
export interface DashboardData {
  iso3: string;
  dashboard: DashboardSpec;
  data: {
    fields: Record<string, FieldData>;
    trends: Record<string, TrendData>;
    trade: TradeData | null;
    executive_summary?: string;
    analysis?: string;
    predictive?: string;
    council?: string;
  };
}

// ── Full Dossier (from /dossier/{country}/full) ──────────────
export interface FullDossierResponse {
  stage: string;
  cached: boolean;
  country: string;
  iso2: string;
  iso3: string;
  coverage: number;
  found: number;
  expected: number;
  not_found: string[];
  fields: Record<string, {
    name: string;
    domain: string;
    value: string | null;
    unit: string | null;
    found: boolean;
    source: string;
    source_url: string;
    as_of: string;
    tier: number;
    confidence: string;
    corroborated: boolean;
  }>;
  summary?: string;
  analysis?: string;
  talking_points?: string;
  predictive?: string;
  council?: string;
  trends: Record<string, TrendData>;
  trade: TradeData | null;
  tearsheet: TearsheetData | null;
  dashboard: DashboardSpec | null;
  updated_at?: string;
}

export interface FieldData {
  value: string | number | null;
  unit?: string;
  found: boolean;
  domain?: string;
  source?: string;
  source_url?: string;
  as_of?: string;
}

export interface TrendData {
  unit: string;
  latest: number;
  latest_year: number;
  base_year: number;
  span_years: number;
  good_up: boolean;
  spark: number[];
  direction: 'up' | 'down' | 'flat';
  source: string;
  url: string;
  delta_pp?: number;
  cagr_pct?: number;
  change_pct?: number;
}

// ── Trade ──────────────────────────────────────────────────────
export interface TradeData {
  year: number;
  export_partners: TradePartner[];
  import_partners: TradePartner[];
  export_goods: TradeGoods[];
  import_goods: TradeGoods[];
  source_url?: string;
}

export interface TradePartner {
  name: string;
  value: number;
  code: string;
  share_pct: number;
}

export interface TradeGoods {
  name: string;
  value: number;
  code: string;
  share_pct: number;
}

// ── Tearsheet ──────────────────────────────────────────────────
export interface TearsheetData {
  country: string;
  iso3: string;
  headline: HeadlineItem[];
  trajectory: TrajectoryItem[];
  snapshot: SnapshotItem[];
  sectors: SnapshotItem[];
  energy: SnapshotItem[];
  uae: SnapshotItem[];
  trade: TradeData | null;
  read: string | null;
  gdp_per_capita_trend?: {
    latest: number;
    year: number;
    cagr_pct: number;
    change_pct: number;
    direction: string;
    spark: number[];
    span_years: number;
    display: string;
  };
}

export interface HeadlineItem {
  key: string;
  display: string;
  unit: string;
  as_of: string;
  source: string;
  trend?: {
    direction: string;
    good_up: boolean;
    span_years: number;
    spark: number[];
    delta_pp?: number;
    change_pct?: number;
    cagr_pct?: number;
  };
}

export interface TrajectoryItem {
  key: string;
  latest: number;
  latest_year: number;
  unit: string;
  direction: string;
  good_up: boolean;
  spark: number[];
  move: string;
  display: string;
}

export interface SnapshotItem {
  key: string;
  value: string | number;
  unit?: string;
  display: string;
  source?: string;
  source_url?: string;
  as_of?: string;
}

// ── Library ────────────────────────────────────────────────────
export interface LibraryCountry {
  country_iso: string;
  name: string;
  iso2: string;
  updated_at: string;
  found: number;
  total: number;
}

// ── Report ─────────────────────────────────────────────────────
export type ReportRole = 'minister' | 'deputy' | 'client' | 'manager' | 'team';

// ── Navigation ─────────────────────────────────────────────────
export type Section = 'dashboard' | 'profile' | 'reports' | 'compare' | 'chat' | 'briefings' | 'admin';

// ── SSE Event (streaming build) ───────────────────────────────
export interface BuildEvent {
  event: 'progress' | 'field' | 'done' | 'error' | 'start' | 'agent' | 'council' | 'warn';
  message?: string;
  field_name?: string;
  domain?: string;
  value?: string;
  percent?: number;
  error?: string;
  run_id?: string;
}

// ── Chat ───────────────────────────────────────────────────────
export interface ChatResponse {
  answer: string;
  countries: string[];
}

// ── Compare ────────────────────────────────────────────────────
export interface CompareData {
  countries: Array<{
    iso3: string;
    name: string;
    fields: Record<string, FieldData>;
  }>;
  fields: string[];
  domains: string[];
}

// ── Sources ────────────────────────────────────────────────────
export interface SourceInfo {
  name: string;
  url: string;
  description: string;
  update_frequency: string;
}

// ── News ──────────────────────────────────────────────────────
export interface NewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
}

// ── Activity Log ──────────────────────────────────────────────
export interface LogEvent {
  id: number;
  run_id: string | null;
  actor_type: string;
  actor: string;
  action: string;
  detail: string | null;
  country_iso: string | null;
  created_at: string;
}

// ── Model Config ──────────────────────────────────────────────
export interface ModelConfig {
  default_provider: string;
  active_provider: string;
  providers: string[];
  options: string[];
  agents: Record<string, {
    model: string;
    temperature: number;
  }>;
}

// ── Source Management (v2) ─────────────────────────────────────
export interface SourceEntry {
  id: number;
  domain: string;
  name: string;
  tier: number;
  category: string;
  status: 'trusted' | 'blocked' | 'unverified';
  url?: string;
  description?: string;
}

// ── Field Editing (v2) ────────────────────────────────────────
export interface FieldEditPayload {
  value: string;
  source?: string;
  note?: string;
  changed_by?: string;
}

export interface FieldHistoryEntry {
  id: number;
  country_iso: string;
  field_name: string;
  old_value: string | null;
  new_value: string;
  changed_by: string;
  note: string | null;
  timestamp: string;
}

// ── Build Runs (v2) ───────────────────────────────────────────
export interface BuildRun {
  run_id: string;
  country_iso: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  finished_at: string | null;
  duration_s?: number;
}

// ── Agent Memory (v2) ─────────────────────────────────────────
export interface AgentMemoryEntry {
  id: number;
  run_id: string;
  agent: string;
  note: string;
  created_at: string;
}

// ── API Keys (v2) ──────────────────────────────────────────────
export interface APIKeyEntry {
  provider: string;
  added_by: string;
  added_at: string;
  has_key: boolean;
}

export interface APIKeyPayload {
  provider: string;
  key: string;
}

// ── Internal Datasets (v2) ────────────────────────────────────
export interface InternalDataset {
  id: number;
  name: string;
  filename: string | null;
  n_rows: number;
  uploaded_by: string;
  created_at: string;
  preview?: string[][];
}

export interface InternalDatasetPayload {
  name: string;
  content: string;
  filename?: string;
}

// ── Monitor (v2) ──────────────────────────────────────────────
export interface MonitorStatus {
  country_iso: string;
  active: boolean;
  last_checked: string | null;
  changes_detected: number;
}

// ── Admin Tab Type ─────────────────────────────────────────────
export type AdminTab = 'sources' | 'logs' | 'runs' | 'memory' | 'models';
