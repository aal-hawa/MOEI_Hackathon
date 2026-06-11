import { authFetch } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────

export interface AIModel {
  id: string
  name: string
  provider: string
  modelId: string
  baseUrl: string
  apiKey: string | null
  isActive: boolean
  isDefault: boolean
  capabilities: string
  maxTokens: number
  temperature: number
  descriptionEN: string | null
  descriptionAR: string | null
  lastTestedAt: string | null
  lastTestResult: string | null
  createdAt: string
}

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  family?: string
  parameterSize?: string
  quantization?: string
}

export interface SeedResult {
  message: string
}

export interface TestResult {
  success: boolean
  message: string
  responseTime?: number
}

export interface ModelTestConfig {
  id: string
}

export interface ModelFormData {
  name: string
  provider: string
  modelId: string
  baseUrl: string
  apiKey?: string | null
  isActive: boolean
  isDefault: boolean
  capabilities: string | string[]
  maxTokens: number
  temperature: number
  descriptionEN?: string | null
  descriptionAR?: string | null
}

export interface PullResult {
  message: string
}

export interface OllamaListResult {
  connected: boolean
  models: OllamaModel[]
}

export interface HardwareInfo {
  ramGb: number
  cores: number
  hasGPU: boolean
  gpuName: string | null
  vramGb: number
}

export interface HardwareResult {
  success: boolean
  hardware: HardwareInfo
}

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Fetch all configured AI models.
 * Mirrors: authFetch('/api/models')
 */
export async function fetchModels(): Promise<AIModel[]> {
  const res = await authFetch('/api/models')
  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : (data.models || [])
}

/**
 * Seed default AI models.
 * Mirrors: authFetch('/api/models/seed', { method: 'POST' })
 */
export async function seedModels(): Promise<SeedResult> {
  const res = await authFetch('/api/models/seed', { method: 'POST' })
  if (!res.ok) {
    throw new Error('Failed to seed models')
  }
  const data = await res.json()
  return data as SeedResult
}

/**
 * Test a model's connection.
 * Mirrors: authFetch('/api/models/test', { method: 'POST', body: { id } })
 */
export async function testModelConnection(config: ModelTestConfig): Promise<TestResult> {
  const res = await authFetch('/api/models/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: config.id }),
  })
  const data = await res.json()
  return data as TestResult
}

/**
 * Save (create or update) an AI model.
 * - If `data.id` is set → PATCH /api/models/:id (update)
 * - Otherwise → POST /api/models (create)
 */
export async function saveModel(data: Partial<ModelFormData> & { id?: string }): Promise<AIModel> {
  const payload = {
    name: data.name,
    provider: data.provider,
    modelId: data.modelId,
    baseUrl: data.baseUrl,
    apiKey: data.apiKey,
    isActive: data.isActive,
    isDefault: data.isDefault,
    capabilities: data.capabilities,
    maxTokens: data.maxTokens,
    temperature: data.temperature,
    descriptionEN: data.descriptionEN,
    descriptionAR: data.descriptionAR,
  }

  if (data.id) {
    const res = await authFetch(`/api/models/${data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.error || 'Failed to update model')
    }
    return (await res.json()) as AIModel
  }

  const res = await authFetch('/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || 'Failed to create model')
  }
  return (await res.json()) as AIModel
}

/**
 * Delete an AI model by ID.
 * Mirrors: authFetch(`/api/models/${id}`, { method: 'DELETE' })
 */
export async function deleteModel(id: string): Promise<void> {
  const res = await authFetch(`/api/models/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Failed to delete model')
  }
}

/**
 * Search for Ollama models in the registry.
 * Mirrors: authFetch(`/api/models/ollama/search?q=${query}`)
 */
export async function searchOllamaModels(query: string): Promise<OllamaModel[]> {
  const res = await authFetch(`/api/models/ollama/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    throw new Error('Failed to search Ollama models')
  }
  const data = await res.json()
  return data.models || []
}

/**
 * Search for HuggingFace models.
 * Mirrors: authFetch(`/api/models/hf/search?q=${query}`)
 */
export async function searchHFModels(query: string): Promise<unknown[]> {
  const res = await authFetch(`/api/models/hf/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    throw new Error('Failed to search HuggingFace models')
  }
  const data = await res.json()
  return data.models || []
}

/**
 * Pull (download) an Ollama model.
 * Mirrors: authFetch('/api/models/ollama/pull', { method: 'POST', body: { modelName } })
 */
export async function pullOllamaModel(modelName: string): Promise<PullResult> {
  const res = await authFetch('/api/models/ollama/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelName }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Failed to pull model')
  }
  return data as PullResult
}

/**
 * Delete a local Ollama model.
 * Mirrors: authFetch('/api/models/ollama/delete', { method: 'DELETE', body: { modelName } })
 */
export async function deleteOllamaModel(modelName: string): Promise<void> {
  const res = await authFetch('/api/models/ollama/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelName }),
  })
  if (!res.ok) {
    throw new Error('Failed to delete Ollama model')
  }
}

/**
 * List installed Ollama models and connection status.
 * Mirrors: authFetch('/api/models/ollama/list')
 */
export async function fetchOllamaModels(): Promise<OllamaListResult> {
  const res = await authFetch('/api/models/ollama/list')
  if (!res.ok) {
    return { connected: false, models: [] }
  }
  const data = await res.json()
  return data as OllamaListResult
}

/**
 * Fetch detected hardware info.
 * Mirrors: authFetch('/api/system/hardware')
 */
export async function fetchHardware(): Promise<HardwareResult | null> {
  try {
    const res = await authFetch('/api/system/hardware')
    if (!res.ok) return null
    const data = await res.json()
    return data.success ? (data as HardwareResult) : null
  } catch {
    return null
  }
}
