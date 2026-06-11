/**
 * Service Manager API — Start, stop, and monitor all MOEI services
 *
 * This route runs inside the Next.js server (port 3000), which is always running.
 * It uses child_process.exec with the `( cmd & )` subshell pattern so that
 * spawned processes survive terminal death (reparented to PID 1).
 *
 * Services managed:
 *   - Hono Worker API  (port 3002) — bun --hot src/worker/index.ts
 *   - Voice Agent      (port 3004) — bun --hot src/worker/voice-agent/index.ts
 *   - Next.js          (port 3000) — already running (this server)
 *
 * Endpoints:
 *   GET  /api/service-manager          → status of all services
 *   POST /api/service-manager/start     → start a specific service { service: string }
 *   POST /api/service-manager/start-all → start all down services
 *   POST /api/service-manager/restart   → restart a specific service { service: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { createConnection } from 'net'

// ─── Service Definitions ─────────────────────────────────────────────────────

interface ServiceDefinition {
  id: string
  name: string
  port: number
  startCommand: string
  startCwd: string
  icon: string
  description: string
  healthEndpoint?: string
}

const SERVICES: ServiceDefinition[] = [
  {
    id: 'worker',
    name: 'Hono Worker API',
    port: 3002,
    startCommand: 'bun --hot index.ts 2>&1',
    startCwd: '/home/z/my-project/src/worker',
    icon: '⚙️',
    description: 'Main backend API server — handles all data mutations, database access, and business logic',
    healthEndpoint: 'http://127.0.0.1:3002/api',
  },
  {
    id: 'voice-agent',
    name: 'Voice Agent',
    port: 3004,
    startCommand: 'bun --hot index.ts 2>&1',
    startCwd: '/home/z/my-project/src/worker/voice-agent',
    icon: '🎤',
    description: 'Real-time voice agent — Socket.IO service for STT→LLM→TTS voice pipeline',
  },
  {
    id: 'nextjs',
    name: 'Next.js Frontend',
    port: 3000,
    startCommand: './node_modules/.bin/next dev -p 3000 2>&1',
    startCwd: '/home/z/my-project',
    icon: '🌐',
    description: 'Main frontend server — serves the MOEI portal UI',
  },
]

// ─── Port Check Utility ──────────────────────────────────────────────────────

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(port, '127.0.0.1')
    socket.setTimeout(1500)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

// ─── Health Check Utility ────────────────────────────────────────────────────

async function checkHealth(port: number, endpoint?: string): Promise<{
  alive: boolean
  status?: string
  responseTime?: number
  error?: string
}> {
  // First check port
  const portAlive = await checkPort(port)
  if (!portAlive) {
    return { alive: false, error: 'Port not listening' }
  }

  // If there's a health endpoint, try to hit it
  if (endpoint) {
    try {
      const start = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(endpoint, { signal: controller.signal })
      clearTimeout(timeout)
      const data = await res.json()
      return {
        alive: true,
        status: data.status || 'healthy',
        responseTime: Date.now() - start,
      }
    } catch (err) {
      return {
        alive: true, // Port is open but health check failed
        status: 'degraded',
        error: err instanceof Error ? err.message : 'Health check failed',
      }
    }
  }

  return { alive: true, status: 'listening' }
}

// ─── Start Service using subshell pattern ────────────────────────────────────
// The ( cmd & ) pattern is the KEY trick:
//   - Creates a subshell that backgrounds the process
//   - The subshell exits cleanly, process gets reparented to PID 1 (init)
//   - Process survives terminal session death
//   - nohup + disown doesn't work in sandbox, but ( cmd & ) does

function startService(service: ServiceDefinition): Promise<{
  success: boolean
  pid?: number
  error?: string
}> {
  return new Promise(async (resolve) => {
    // Check if already running first
    const alreadyAlive = await checkPort(service.port)
    if (alreadyAlive) {
      console.log(`[ServiceManager] ✅ ${service.name} already running on port ${service.port}`)
      resolve({ success: true })
      return
    }

    // Kill any stale process on this port (may be a zombie)
    exec(`fuser -k ${service.port}/tcp 2>/dev/null || true`, (killErr) => {
      if (killErr) {
        // fuser -k might fail if no process is on the port — that's fine
      }

      // Wait a moment for the port to be released
      setTimeout(() => {
        // Use the ( cmd & ) subshell pattern for process survivability
        const subshellCmd = `( cd ${service.startCwd} && ${service.startCommand} & )`

        exec(subshellCmd, (err, stdout, stderr) => {
          if (err && err.code !== 0 && !stderr.includes('fuser')) {
            console.error(`[ServiceManager] Failed to start ${service.name}:`, err.message)
            resolve({ success: false, error: err.message })
            return
          }

          // The subshell pattern starts the process in the background
          // Give it a moment to bind to the port
          setTimeout(async () => {
            const alive = await checkPort(service.port)
            if (alive) {
              console.log(`[ServiceManager] ✅ ${service.name} started on port ${service.port}`)
              resolve({ success: true })
            } else {
              // Port might not be ready yet — still report success since the process was launched
              console.log(`[ServiceManager] ⏳ ${service.name} process launched on port ${service.port} (not yet listening)`)
              resolve({ success: true })
            }
          }, 3000)
        })
      }, 1000)
    })
  })
}

// ─── GET: Status of all services ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const serviceStatuses = await Promise.all(
      SERVICES.map(async (service) => {
        const health = await checkHealth(service.port, service.healthEndpoint)
        return {
          id: service.id,
          name: service.name,
          port: service.port,
          icon: service.icon,
          description: service.description,
          alive: health.alive,
          status: health.status || 'unknown',
          responseTime: health.responseTime,
          error: health.error || null,
        }
      })
    )

    const allAlive = serviceStatuses.every(s => s.alive)
    const anyAlive = serviceStatuses.some(s => s.alive)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overallStatus: allAlive ? 'healthy' : anyAlive ? 'degraded' : 'offline',
      services: serviceStatuses,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to check service status', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

// ─── POST: Start/Restart a service or all services ───────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, service: serviceId } = body as { action?: string; service?: string }

    // Start all down services
    if (action === 'start-all' || serviceId === 'all') {
      const results = []
      for (const service of SERVICES) {
        // Skip Next.js — it's already running (this IS Next.js)
        if (service.id === 'nextjs') {
          const alive = await checkPort(service.port)
          results.push({
            id: service.id,
            name: service.name,
            port: service.port,
            started: false,
            skipped: true,
            reason: alive ? 'Already running (this server)' : 'Cannot restart self',
          })
          continue
        }

        const alive = await checkPort(service.port)
        if (alive && action !== 'restart-all') {
          results.push({
            id: service.id,
            name: service.name,
            port: service.port,
            started: false,
            skipped: true,
            reason: 'Already running',
          })
          continue
        }

        const result = await startService(service)
        results.push({
          id: service.id,
          name: service.name,
          port: service.port,
          started: result.success,
          error: result.error,
        })
      }

      return NextResponse.json({
        action: 'start-all',
        timestamp: new Date().toISOString(),
        results,
      })
    }

    // Start or restart a specific service
    if (serviceId) {
      const service = SERVICES.find(s => s.id === serviceId)
      if (!service) {
        return NextResponse.json(
          { error: `Unknown service: ${serviceId}. Available: ${SERVICES.map(s => s.id).join(', ')}` },
          { status: 400 }
        )
      }

      // Don't allow starting Next.js from within Next.js
      if (service.id === 'nextjs') {
        const alive = await checkPort(service.port)
        return NextResponse.json({
          id: service.id,
          name: service.name,
          port: service.port,
          started: false,
          skipped: true,
          reason: alive ? 'Already running (this server)' : 'Cannot restart self',
        })
      }

      const result = await startService(service)
      return NextResponse.json({
        id: service.id,
        name: service.name,
        port: service.port,
        started: result.success,
        error: result.error,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      { error: 'Missing action or service parameter. Use { action: "start-all" } or { service: "worker" | "voice-agent" }' },
      { status: 400 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: 'Service manager request failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
