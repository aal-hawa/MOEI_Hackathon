/**
 * Agents Route
 * GET /api/agents
 * GET /api/agents/performance
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.get('/agents', async (c) => {
  try {
    const agents = await db.agent.findMany({
      orderBy: { name: 'asc' },
    })
    return c.json(agents)
  } catch (error) {
    console.error('Agents GET error:', error)
    return c.json({ error: 'Failed to fetch agents' }, 500)
  }
})

// ─── GET /agents/performance ───────────────────────────────────────────────
// Returns agents with performance stats: resolved cases, avg response time, CSAT
app.get('/agents/performance', async (c) => {
  try {
    const agents = await db.agent.findMany({
      orderBy: { name: 'asc' },
    })

    const performanceData = await Promise.all(
      agents.map(async (agent) => {
        // Count resolved cases assigned to this agent
        const resolvedCases = await db.case.count({
          where: {
            assignedAgent: agent.email,
            status: 'resolved',
          },
        })

        // Count active cases
        const activeCasesCount = await db.case.count({
          where: {
            assignedAgent: agent.email,
            status: { in: ['open', 'in_progress'] },
          },
        })

        // Get resolved cases with timestamps for avg resolution time
        const resolvedCaseData = await db.case.findMany({
          where: {
            assignedAgent: agent.email,
            status: 'resolved',
            resolvedAt: { not: null },
          },
          select: {
            createdAt: true,
            resolvedAt: true,
          },
        })

        // Calculate avg resolution time in minutes
        let avgResolutionMin = 0
        if (resolvedCaseData.length > 0) {
          const totalMin = resolvedCaseData.reduce((sum, c) => {
            if (c.resolvedAt) {
              const diffMs = new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime()
              return sum + diffMs / (1000 * 60)
            }
            return sum
          }, 0)
          avgResolutionMin = Math.round(totalMin / resolvedCaseData.length)
        }

        // Get CSAT from feedback related to this agent's cases
        const agentCases = await db.case.findMany({
          where: {
            assignedAgent: agent.email,
          },
          select: { id: true },
        })
        const caseIds = agentCases.map((c) => c.id)

        let avgCsat = 0
        if (caseIds.length > 0) {
          const feedbacks = await db.feedback.findMany({
            where: {
              caseId: { in: caseIds },
            },
            select: { rating: true },
          })
          if (feedbacks.length > 0) {
            avgCsat = Math.round((feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length) * 10) / 10
          }
        }

        // Get recent interactions for avg response time estimation
        // We use interactions on this agent's cases to estimate response time
        const agentInteractions = await db.interaction.findMany({
          where: {
            caseId: { in: caseIds },
            direction: 'outbound',
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { createdAt: true, caseId: true },
        })

        // Estimate avg response time: time between first inbound and first outbound per case
        let avgResponseSec = 0
        if (caseIds.length > 0) {
          const responseTimes: number[] = []
          for (const caseId of caseIds.slice(0, 20)) {
            const firstInbound = await db.interaction.findFirst({
              where: { caseId, direction: 'inbound' },
              orderBy: { createdAt: 'asc' },
              select: { createdAt: true },
            })
            const firstOutbound = await db.interaction.findFirst({
              where: { caseId, direction: 'outbound' },
              orderBy: { createdAt: 'asc' },
              select: { createdAt: true },
            })
            if (firstInbound && firstOutbound) {
              const diffSec = (new Date(firstOutbound.createdAt).getTime() - new Date(firstInbound.createdAt).getTime()) / 1000
              if (diffSec > 0) responseTimes.push(diffSec)
            }
          }
          if (responseTimes.length > 0) {
            avgResponseSec = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          }
        }

        return {
          id: agent.id,
          name: agent.name,
          nameAr: agent.nameAr,
          email: agent.email,
          role: agent.role,
          status: agent.status,
          skills: agent.skills,
          languages: agent.languages,
          avatar: agent.avatar,
          activeCases: agent.activeCases,
          casesResolved: resolvedCases,
          activeCasesCount,
          avgResolutionMin,
          avgResponseSec,
          avgResponseMin: Math.floor(avgResponseSec / 60),
          csatRating: avgCsat || (resolvedCases > 0 ? 4.0 : 0),
        }
      })
    )

    // Sort by cases resolved descending
    performanceData.sort((a, b) => b.casesResolved - a.casesResolved)

    return c.json(performanceData)
  } catch (error) {
    console.error('Agents Performance GET error:', error)
    return c.json({ error: 'Failed to fetch agent performance' }, 500)
  }
})

export const agentsRoutes = app
