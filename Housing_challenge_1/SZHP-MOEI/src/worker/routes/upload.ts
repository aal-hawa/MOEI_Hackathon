/**
 * Upload Routes (R2)
 * POST /api/upload, GET /api/upload, DELETE /api/upload
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { verifyAuth } from '../middleware/auth'
import { generateId } from '../lib/utils'
import { getConfigNumber } from '../lib/config'

const upload = new Hono<{ Bindings: Env }>()

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx']

// POST /api/upload
upload.post('/', async (c) => {
  try {
    const db = new DbClient(c.env.DB)
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    let isAdmin = false
    if (token) {
      const authResult = await verifyAuth(db, token)
      isAdmin = authResult.authenticated && ['employee', 'reviewer', 'manager', 'admin', 'superadmin'].includes(authResult.user?.role || '')
    }

    const contentType = c.req.header('content-type') || ''
    if (!contentType.includes('multipart/form-data')) return c.json({ error: 'Must be multipart/form-data' }, 400)

    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'No file provided' }, 400)
    if (!ALLOWED_TYPES.includes(file.type)) return c.json({ error: `File type "${file.type}" not allowed` }, 400)

    const adminMaxMB = await getConfigNumber(db, c.env.KV, 'max_file_upload_size_mb', 10)
    const maxMB = isAdmin ? adminMaxMB : Math.min(adminMaxMB, 5)
    if (file.size > maxMB * 1024 * 1024) return c.json({ error: `File exceeds ${maxMB}MB limit` }, 400)

    const fileId = generateId()
    const clientExt = '.' + file.name.split('.').pop()?.toLowerCase() || '.bin'
    const ext = ALLOWED_EXTENSIONS.includes(clientExt) ? clientExt : '.bin'
    const storedName = `${fileId}${ext}`

    await c.env.STORAGE.put(storedName, file.stream(), { httpMetadata: { contentType: file.type } })

    return c.json({ data: { id: fileId, originalName: file.name, storedName, size: file.size, type: file.type, uploadedAt: new Date().toISOString() } }, 201)
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Failed to upload file' }, 500)
  }
})

// GET /api/upload?file=storedName
upload.get('/', async (c) => {
  try {
    const fileName = c.req.query('file')
    if (!fileName) return c.json({ error: 'File name required' }, 400)

    const object = await c.env.STORAGE.get(fileName)
    if (!object) return c.json({ error: 'File not found' }, 404)

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('Content-Disposition', `inline; filename="${fileName}"`)

    return new Response(object.body, { headers })
  } catch (error) {
    console.error('Serve file error:', error)
    return c.json({ error: 'Failed to serve file' }, 500)
  }
})

// DELETE /api/upload?file=storedName
upload.delete('/', async (c) => {
  try {
    const fileName = c.req.query('file')
    if (!fileName) return c.json({ error: 'File name required' }, 400)

    await c.env.STORAGE.delete(fileName)
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete upload error:', error)
    return c.json({ error: 'Failed to delete file' }, 500)
  }
})

export default upload
