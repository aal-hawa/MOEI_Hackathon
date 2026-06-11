import { authFetch } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────

export interface UploadedFileData {
  id: string
  originalName: string
  storedName: string
  size: number
  type: string
  uploadedAt: string
  docType?: string
}

export interface UploadResult {
  data: UploadedFileData
}

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Upload a file to the server.
 * Mirrors: authFetch('/api/upload', { method: 'POST', body: FormData })
 * Returns the parsed response with { data: fileData }
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await authFetch('/api/upload', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).error || 'Upload failed')
  }
  const result = await res.json()
  return result as UploadResult
}

/**
 * Download a file as a Blob by its stored name.
 * Mirrors: authFetch(`/api/upload?file=${storedName}`)
 */
export async function downloadFile(fileId: string): Promise<Blob> {
  const res = await authFetch(`/api/upload?file=${encodeURIComponent(fileId)}`)
  if (!res.ok) {
    throw new Error('Download failed')
  }
  return await res.blob()
}

/**
 * View a file — fetches the file and returns an object URL for preview.
 * Mirrors: authFetch(`/api/upload?file=${storedName}`)
 * The caller should revoke the URL with URL.revokeObjectURL when done.
 */
export async function viewFile(fileId: string, mimeType?: string): Promise<string> {
  const res = await authFetch(`/api/upload?file=${encodeURIComponent(fileId)}`)
  if (!res.ok) {
    throw new Error('Failed to fetch file for viewing')
  }
  const rawBlob = await res.blob()
  // Force the correct mime type so the browser renders it properly
  const blob = new Blob([rawBlob], { type: mimeType || 'application/pdf' })
  return URL.createObjectURL(blob)
}

/**
 * Delete an uploaded file by its stored name.
 * Mirrors: authFetch(`/api/upload?file=${storedName}`, { method: 'DELETE' })
 */
export async function deleteFile(storedName: string): Promise<void> {
  const res = await authFetch(`/api/upload?file=${encodeURIComponent(storedName)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error('Failed to delete file')
  }
}
