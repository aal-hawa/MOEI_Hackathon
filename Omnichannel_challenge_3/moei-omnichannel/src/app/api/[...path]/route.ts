/**
 * API Proxy Route — Forwards all /api/* requests to the Hono Worker backend
 * 
 * In the sandbox: Next.js (port 3000) proxies API requests to the worker (port 3001)
 * On Cloudflare: Frontend (Pages) calls Worker API directly
 * 
 * This ensures the project works with ONLY pages + worker, no mini-services needed.
 */

import { NextRequest, NextResponse } from 'next/server'

const WORKER_URL = 'http://localhost:3002'

async function proxyRequest(request: NextRequest, method: string) {
  try {
    const path = request.nextUrl.pathname + request.nextUrl.search
    const workerUrl = `${WORKER_URL}${path}`
    
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      // Forward relevant headers but skip host and connection
      if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
        headers[key] = value
      }
    })

    let body: string | undefined
    if (method !== 'GET' && method !== 'HEAD') {
      body = await request.text()
    }

    const response = await fetch(workerUrl, {
      method,
      headers,
      body,
    })

    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      // Skip transfer-encoding as Next.js handles it
      if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    const responseBody = await response.arrayBuffer()
    
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[API Proxy] Error forwarding request:', error)
    return NextResponse.json(
      { 
        error: 'Worker backend unavailable', 
        message: 'The API worker is not running. Please start it with: bun --hot src/worker/index.ts' 
      }, 
      { status: 502 }
    )
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET')
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST')
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT')
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE')
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH')
}
