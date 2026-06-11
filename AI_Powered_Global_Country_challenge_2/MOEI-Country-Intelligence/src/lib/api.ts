/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – API Client
   All requests route through the Caddy gateway using
   the XTransformPort query parameter.
   ─────────────────────────────────────────────────────────────── */

import type {
  LibraryCountry,
  DossierResponse,
  DashboardData,
  TearsheetData,
  BuildEvent,
  ChatResponse,
  CompareData,
  FieldData,
  SourceInfo,
  FullDossierResponse,
  NewsItem,
  LogEvent,
  ModelConfig,
  SourceEntry,
  FieldEditPayload,
  FieldHistoryEntry,
  BuildRun,
  AgentMemoryEntry,
  APIKeyEntry,
  APIKeyPayload,
  InternalDataset,
  InternalDatasetPayload,
  MonitorStatus,
} from './types';

// ── Gateway helpers ────────────────────────────────────────────

const API_BASE = '';
const BACKEND_PORT = 3050;

/**
 * Build a URL that routes through the Caddy gateway.
 * Appends XTransformPort as a query parameter.
 */
function apiUrl(path: string, extraParams?: Record<string, string>): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  url.searchParams.set('XTransformPort', String(BACKEND_PORT));
  if (extraParams) {
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }
  return url.pathname + url.search;
}

// ── Generic fetch wrapper ──────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string>; silent404?: boolean },
): Promise<T | null> {
  const { params, silent404, ...fetchOptions } = options ?? {};
  const url = apiUrl(path, params);

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions?.headers,
      },
      ...fetchOptions,
    });

    if (!response.ok) {
      // For 404s/500s with silent404 flag, return null instead of throwing
      // (500 often means data hasn't been built yet, e.g. dossier endpoints)
      if ((response.status === 404 || response.status === 500) && silent404) {
        return null;
      }
      const errorBody = await response.text().catch(() => '');
      throw new ApiError(
        response.status,
        `API error ${response.status}: ${errorBody || response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  } catch (error) {
    // If it's a network error (backend not running) and silent404 is set, return null
    if (silent404 && error instanceof TypeError && error.message.includes('fetch')) {
      return null;
    }
    throw error;
  }
}

// ── Custom error ───────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ── Library ────────────────────────────────────────────────────

/**
 * Fetch the full list of countries in the library.
 */
export async function fetchLibrary(): Promise<LibraryCountry[]> {
  try {
    const data = await apiFetch<{ countries: LibraryCountry[] }>('/library');
    return data?.countries ?? [];
  } catch {
    return [];
  }
}

// ── Dossier ────────────────────────────────────────────────────

/**
 * Fetch the raw dossier (all fields) for a given country.
 */
export async function fetchDossier(country: string): Promise<DossierResponse> {
  return apiFetch<DossierResponse>(`/dossier/${country}`);
}

// ── Dashboard ──────────────────────────────────────────────────

/**
 * Fetch the assembled dashboard data for a country.
 * Optionally pass a language code for localised responses.
 */
export async function fetchDashboard(
  country: string,
  lang?: string,
): Promise<DashboardData | null> {
  return apiFetch<DashboardData>(`/dossier/${country}/dashboard`, {
    params: lang ? { lang } : undefined,
    silent404: true,
  });
}

// ── Tearsheet ──────────────────────────────────────────────────

/**
 * Fetch the concise tearsheet (headline, trajectory, snapshot) for a country.
 */
export async function fetchTearsheet(
  country: string,
  lang?: string,
): Promise<TearsheetData | null> {
  const data = await apiFetch<{ iso3: string; tearsheet: TearsheetData }>(`/dossier/${country}/tearsheet`, {
    params: lang ? { lang } : undefined,
    silent404: true,
  });
  if (!data) return null;
  return data.tearsheet;
}

// ── Build Dossier ──────────────────────────────────────────────

/**
 * Trigger a synchronous dossier build for a country.
 */
export async function buildDossier(
  country: string,
  lang?: string,
): Promise<unknown> {
  return apiFetch<unknown>(`/dossier/${country}`, {
    method: 'POST',
    params: lang ? { lang } : undefined,
  });
}

/**
 * Stream a dossier build using Server-Sent Events.
 * Calls `onEvent` for every SSE event received.
 * Resolves when the stream ends (event: "done") or rejects on error.
 */
export async function streamBuild(
  country: string,
  onEvent: (ev: BuildEvent) => void,
  lang?: string,
): Promise<void> {
  const url = apiUrl(`/dossier/${country}/stream`, lang ? { lang } : undefined);

  const response = await fetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Stream build failed: ${response.statusText}`,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('ReadableStream not supported');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep incomplete line in buffer

    let currentEvent = '';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6);
      } else if (line === '') {
        // Empty line = end of SSE message
        if (currentEvent || currentData) {
          try {
            const parsed = JSON.parse(currentData) as BuildEvent;
            onEvent(parsed);
          } catch {
            // If JSON parse fails, send a generic progress event
            onEvent({
              event: (currentEvent as BuildEvent['event']) || 'progress',
              message: currentData,
            });
          }
          currentEvent = '';
          currentData = '';
        }
      }
    }
  }
}

// ── Compare ────────────────────────────────────────────────────

/** Raw compare response from backend */
interface CompareBackendResponse {
  countries: Array<{ name: string; iso3: string }>;
  metrics: Array<{
    field: string;
    label: string;
    unit: string | null;
    better: string;
    cells: Record<string, {
      value: string | null;
      num: number | null;
      as_of?: string;
      source?: string;
    }>;
    leader?: string;
    max?: number;
    min?: number;
  }>;
}

/**
 * Fetch comparison data for multiple countries.
 * Transforms the backend metrics-based response into the frontend format.
 */
export async function fetchCompare(
  countries: string[],
  lang?: string,
): Promise<CompareData> {
  const raw = await apiFetch<CompareBackendResponse>('/compare', {
    params: {
      countries: countries.join(','),
      ...(lang ? { lang } : {}),
    },
  });

  // Build a fields map per country from the metrics
  const countryFields: Record<string, Record<string, FieldData>> = {};
  for (const c of raw.countries) {
    countryFields[c.iso3] = {};
  }

  const fieldKeys: string[] = [];
  const domainSet = new Set<string>();

  for (const metric of raw.metrics) {
    fieldKeys.push(metric.field);
    for (const c of raw.countries) {
      const cell = metric.cells[c.iso3];
      countryFields[c.iso3][metric.field] = {
        value: cell?.value ?? null,
        unit: metric.unit ?? undefined,
        found: cell?.value != null,
        source: cell?.source,
        as_of: cell?.as_of,
      };
      // Use the metric field prefix as domain hint
      const domainHint = metric.field.split('_')[0];
      domainSet.add(domainHint);
    }
  }

  return {
    countries: raw.countries.map((c) => ({
      iso3: c.iso3,
      name: c.name,
      fields: countryFields[c.iso3] ?? {},
    })),
    fields: fieldKeys,
    domains: Array.from(domainSet),
  };
}

// ── Chat ───────────────────────────────────────────────────────

/**
 * Send a chat question and receive an answer with related countries.
 */
export async function sendChat(
  question: string,
  lang?: string,
  countryIso?: string,
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ question, lang, country_iso: countryIso || null }),
  });
}

// ── Sources ────────────────────────────────────────────────────

/**
 * Fetch the list of data sources used by the platform.
 */
export async function fetchSources(): Promise<SourceInfo[]> {
  return apiFetch<SourceInfo[]>('/sources');
}

// ── Full Dossier ──────────────────────────────────────────────

/**
 * Fetch the complete dossier in one call (all fields, trends, trade, tearsheet, dashboard, council).
 */
export async function fetchDossierFull(
  country: string,
  lang?: string,
): Promise<FullDossierResponse | null> {
  return apiFetch<FullDossierResponse>(`/dossier/${country}/full`, {
    params: lang ? { lang } : undefined,
    silent404: true,
  });
}

// ── News ──────────────────────────────────────────────────────

/**
 * Fetch live news headlines (UAE × Central Asia focus).
 */
export async function fetchNews(limit: number = 6): Promise<NewsItem[]> {
  try {
    const data = await apiFetch<{ items: NewsItem[]; live: boolean }>('/news', {
      params: { limit: String(limit) },
    });
    return data?.items ?? [];
  } catch {
    return [];
  }
}

// ── Activity Log ──────────────────────────────────────────────

/**
 * Fetch the activity log (AI and user actions).
 */
export async function fetchLogs(limit: number = 50): Promise<LogEvent[]> {
  try {
    const data = await apiFetch<{ events: LogEvent[] }>('/logs', {
      params: { limit: String(limit) },
    });
    return data?.events ?? [];
  } catch {
    return [];
  }
}

// ── Model Config ──────────────────────────────────────────────

/**
 * Fetch the current per-agent model configuration.
 */
export async function fetchModelConfig(): Promise<ModelConfig | null> {
  return apiFetch<ModelConfig>('/config/models');
}

/**
 * Update the model/temperature for a specific agent.
 */
export async function updateModelConfig(
  agent: string,
  model: string,
  temperature: number,
): Promise<unknown> {
  return apiFetch<unknown>('/config/models', {
    method: 'POST',
    body: JSON.stringify({ agent, model, temperature }),
  });
}

// ── Source Management (v2) ───────────────────────────────────

/**
 * Fetch all data sources with their trust status.
 */
export async function fetchSourceEntries(): Promise<SourceEntry[]> {
  try {
    const data = await apiFetch<{ sources: SourceEntry[] }>('/sources');
    return data?.sources ?? [];
  } catch {
    return [];
  }
}

/**
 * Add a new data source.
 */
export async function addSource(payload: {
  domain: string;
  name: string;
  url: string;
  tier: number;
  category: string;
}): Promise<unknown> {
  return apiFetch<unknown>('/sources', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Set a source's trust status (trusted/blocked).
 */
export async function setSourceStatus(
  domain: string,
  status: 'trusted' | 'blocked',
): Promise<unknown> {
  return apiFetch<unknown>('/sources/status', {
    method: 'POST',
    body: JSON.stringify({ domain, status }),
  });
}

// ── Field Editing (v2) ──────────────────────────────────────

/**
 * Edit a field value for a country dossier.
 */
export async function editField(
  country: string,
  fieldName: string,
  payload: FieldEditPayload,
): Promise<unknown> {
  return apiFetch<unknown>(`/dossier/${country}/field/${fieldName}/edit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get the edit history for a specific field.
 */
export async function fetchFieldHistory(
  country: string,
  fieldName: string,
): Promise<FieldHistoryEntry[]> {
  try {
    const data = await apiFetch<{ history: FieldHistoryEntry[] }>(
      `/dossier/${country}/field/${fieldName}/history`,
    );
    return data?.history ?? [];
  } catch {
    return [];
  }
}

// ── Build Runs (v2) ────────────────────────────────────────

/**
 * Fetch the list of dossier build runs.
 */
export async function fetchBuildRuns(limit: number = 50): Promise<BuildRun[]> {
  try {
    const data = await apiFetch<{ runs: BuildRun[] }>('/runs', {
      params: { limit: String(limit) },
    });
    return data?.runs ?? [];
  } catch {
    return [];
  }
}

// ── Agent Memory (v2) ──────────────────────────────────────

/**
 * Fetch agent memory/notes from previous runs.
 */
export async function fetchAgentMemory(runId?: string): Promise<AgentMemoryEntry[]> {
  try {
    const params = runId ? { run_id: runId } : undefined;
    const data = await apiFetch<{ memory: AgentMemoryEntry[] }>('/memory', { params });
    return data?.memory ?? [];
  } catch {
    return [];
  }
}

// ── API Key Management (v2) ────────────────────────────────

/**
 * Fetch all API key entries (key values are never returned).
 */
export async function fetchAPIKeys(): Promise<APIKeyEntry[]> {
  try {
    const data = await apiFetch<{ keys: APIKeyEntry[] }>('/keys');
    return data?.keys ?? [];
  } catch {
    return [];
  }
}

/**
 * Add or update an API key for a provider.
 */
export async function addAPIKey(payload: APIKeyPayload): Promise<unknown> {
  return apiFetch<unknown>('/keys', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Delete an API key for a provider.
 */
export async function deleteAPIKey(provider: string): Promise<unknown> {
  return apiFetch<unknown>(`/keys/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  });
}

// ── Internal Datasets (v2) ────────────────────────────────

/**
 * Fetch all internal datasets.
 */
export async function fetchInternalDatasets(): Promise<InternalDataset[]> {
  try {
    const data = await apiFetch<{ datasets: InternalDataset[] }>('/internal');
    return data?.datasets ?? [];
  } catch {
    return [];
  }
}

/**
 * Add a new internal dataset.
 */
export async function addInternalDataset(
  payload: InternalDatasetPayload,
): Promise<unknown> {
  return apiFetch<unknown>('/internal', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get a specific internal dataset.
 */
export async function fetchInternalDataset(
  id: number,
): Promise<InternalDataset | null> {
  return apiFetch<InternalDataset>(`/internal/${id}`);
}

/**
 * Delete an internal dataset.
 */
export async function deleteInternalDataset(id: number): Promise<unknown> {
  return apiFetch<unknown>(`/internal/${id}`, {
    method: 'DELETE',
  });
}

// ── Country Monitoring (v2) ────────────────────────────────

/**
 * Toggle monitoring for a country.
 */
export async function toggleMonitor(
  country: string,
  active: boolean,
): Promise<MonitorStatus> {
  return apiFetch<MonitorStatus>(`/monitor/${country}`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

// ── User Action Logging (v2) ──────────────────────────────

/**
 * Log a user action to the activity log.
 */
export async function logUserAction(
  action: string,
  detail?: string,
  countryIso?: string,
): Promise<void> {
  try {
    await apiFetch<unknown>('/logs/user', {
      method: 'POST',
      body: JSON.stringify({
        actor_type: 'user',
        actor: 'web_user',
        action,
        detail: detail ?? null,
        country_iso: countryIso ?? null,
      }),
    });
  } catch {
    // Silently fail — logging should never break the UI
  }
}

// ── Backend Exports (v2) ──────────────────────────────────

/**
 * Download an Excel export from the backend.
 */
export async function exportBackendExcel(country: string): Promise<void> {
  const url = apiUrl(`/dossier/${country}/export.xlsx`);
  window.open(url, '_blank');
}

/**
 * Download a PowerPoint export from the backend.
 */
export async function exportBackendPPTX(country: string): Promise<void> {
  const url = apiUrl(`/dossier/${country}/export.pptx`);
  window.open(url, '_blank');
}

/**
 * Download a PDF export from the backend (Python-side).
 */
export async function exportBackendPDF(country: string): Promise<void> {
  const url = apiUrl(`/dossier/${country}/export.pdf`);
  window.open(url, '_blank');
}

/**
 * Download an SVG infographic from the backend.
 */
export async function exportBackendInfographic(country: string): Promise<void> {
  const url = apiUrl(`/dossier/${country}/infographic.svg`);
  window.open(url, '_blank');
}

