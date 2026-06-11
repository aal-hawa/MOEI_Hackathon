/**
 * Dashboard Routes
 * GET /api/dashboard/kpis
 * GET /api/dashboard/predictions
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.get('/dashboard/kpis', async (c) => {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const totalInteractions = await db.interaction.count({ where: { createdAt: { gte: todayStart } } })
    const activeCases = await db.case.count({ where: { status: { in: ['open', 'in_progress'] } } })
    const agentsOnline = await db.agent.count({ where: { status: 'available' } })

    const interactionsByChannel = await db.interaction.groupBy({
      by: ['channel'],
      _count: { channel: true },
      where: { createdAt: { gte: todayStart } },
    })

    const channelBreakdown: Record<string, number> = {}
    for (const item of interactionsByChannel) {
      channelBreakdown[item.channel] = item._count.channel
    }

    // Resolution metrics
    const resolvedCases = await db.case.findMany({
      where: { status: 'resolved', resolvedAt: { not: undefined } },
      select: { createdAt: true, resolvedAt: true },
      take: 50,
      orderBy: { resolvedAt: 'desc' },
    })

    let avgResolutionTime = 0
    if (resolvedCases.length > 0) {
      const totalHours = resolvedCases.reduce((sum, cs) => {
        if (cs.resolvedAt && cs.createdAt) return sum + (cs.resolvedAt.getTime() - cs.createdAt.getTime()) / (1000 * 60 * 60)
        return sum
      }, 0)
      avgResolutionTime = Math.round((totalHours / resolvedCases.length) * 10) / 10
    }

    const casesWithInteractions = await db.case.findMany({
      where: { status: 'resolved' },
      include: { _count: { select: { interactions: true } } },
      take: 100,
    })

    const firstContactResolution = casesWithInteractions.length > 0
      ? Math.round((casesWithInteractions.filter(cs => cs._count.interactions <= 2).length / casesWithInteractions.length) * 100)
      : 0

    const recentInteractions = await db.interaction.findMany({
      where: { direction: 'inbound', createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      select: { sentiment: true },
      take: 200,
    })

    const csat = recentInteractions.length > 0
      ? Math.round((recentInteractions.reduce((s, i) => s + i.sentiment, 0) / recentInteractions.length) * 5 * 10) / 10
      : 0

    const selfServiceDeflection = 0
    const escalatedCases = await db.case.count({
      where: { priority: 'urgent', createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    })
    const totalRecentCases = await db.case.count({
      where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    })
    const escalationRate = totalRecentCases > 0 ? Math.round((escalatedCases / totalRecentCases) * 100) : 0

    // Calculate 12-hour historical trends for sparklines
    const last12h = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    const trendInteractions = Array(12).fill(0)
    const recentAll = await db.interaction.findMany({
      where: { createdAt: { gte: last12h } },
      select: { createdAt: true }
    })
    for (const i of recentAll) {
      const hoursAgo = Math.floor((now.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60))
      if (hoursAgo >= 0 && hoursAgo < 12) trendInteractions[11 - hoursAgo]++
    }

    const trends = {
      totalInteractions: trendInteractions,
      avgResolutionTime: Array(12).fill(avgResolutionTime),
      firstContactResolution: Array(12).fill(firstContactResolution),
      csat: Array(12).fill(csat),
      selfServiceDeflection: Array(12).fill(selfServiceDeflection),
      escalationRate: Array(12).fill(escalationRate),
      activeCases: Array(12).fill(activeCases),
      agentsOnline: Array(12).fill(agentsOnline),
    }

    return c.json({
      totalInteractions, avgResolutionTime, firstContactResolution, csat,
      selfServiceDeflection, escalationRate, channelBreakdown, activeCases, agentsOnline,
      trends,
    })
  } catch (error) {
    console.error('Dashboard KPIs GET error:', error)
    return c.json({ error: 'Failed to fetch dashboard KPIs' }, 500)
  }
})

app.get('/dashboard/csat', async (c) => {
  try {
    const period = c.req.query('period') || '30d'
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    
    // Compute CSAT trend from real feedback data
    let csatTrendData: Array<{ date: string; score: number; responses: number }> = []
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const feedbackByDay = await db.feedback.findMany({
        where: { createdAt: { gte: startDate } },
        select: { rating: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      // Group by day
      const dayMap = new Map<string, { total: number; count: number }>()
      for (let i = 0; i < days; i++) {
        const d = new Date()
        d.setDate(d.getDate() - (days - i - 1))
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        dayMap.set(key, { total: 0, count: 0 })
      }
      for (const f of feedbackByDay) {
        const key = new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const existing = dayMap.get(key) || { total: 0, count: 0 }
        existing.total += f.rating
        existing.count += 1
        dayMap.set(key, existing)
      }
      csatTrendData = Array.from(dayMap.entries()).map(([date, data]) => ({
        date,
        score: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
        responses: data.count,
      }))
    } catch {
      // Fallback: empty trend data
      csatTrendData = Array.from({ length: days }).map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (days - i - 1))
        return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), score: 0, responses: 0 }
      })
    }

    // Compute channel CSAT from real feedback data
    const channelCSATData = [
      { channel: 'WhatsApp', score: 0, color: '#10b981' },
      { channel: 'Voice', score: 0, color: '#f59e0b' },
      { channel: 'Web Portal', score: 0, color: '#3b82f6' },
      { channel: 'Email', score: 0, color: '#64748b' },
    ]
    try {
      const feedbackByChannel = await db.feedback.findMany({
        select: { rating: true, channel: true },
      })
      const channelMap = new Map<string, { total: number; count: number }>()
      for (const f of feedbackByChannel) {
        const ch = f.channel || 'Web Portal'
        const existing = channelMap.get(ch) || { total: 0, count: 0 }
        existing.total += f.rating
        existing.count += 1
        channelMap.set(ch, existing)
      }
      for (const item of channelCSATData) {
        const data = channelMap.get(item.channel.toLowerCase()) || channelMap.get(item.channel)
        if (data && data.count > 0) {
          item.score = Math.round((data.total / data.count) * 10) / 10
        }
      }
    } catch { /* empty */ }

    // Compute feedback keywords from real feedback comments
    const feedbackKeywords: Array<{ word: string; count: number; sentiment: string }> = []
    try {
      const feedbackComments = await db.feedback.findMany({
        where: { comment: { not: null } },
        select: { comment: true, rating: true },
        take: 100,
      })
      const wordMap = new Map<string, { count: number; positive: number }>()
      for (const f of feedbackComments) {
        if (!f.comment) continue
        const words = f.comment.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        for (const word of words) {
          const existing = wordMap.get(word) || { count: 0, positive: 0 }
          existing.count += 1
          if (f.rating >= 4) existing.positive += 1
          wordMap.set(word, existing)
        }
      }
      for (const [word, data] of wordMap) {
        if (data.count >= 2) {
          feedbackKeywords.push({
            word,
            count: data.count,
            sentiment: data.positive / data.count >= 0.6 ? 'positive' : data.positive / data.count <= 0.3 ? 'negative' : 'neutral',
          })
        }
      }
      feedbackKeywords.sort((a, b) => b.count - a.count)
    } catch { /* empty */ }

    // Compute improvement areas from low-rated feedback
    const improvementAreasData: Array<{ category: string; avgScore: number; severity: string; mentions: number; trend: number }> = []
    try {
      const lowFeedback = await db.feedback.findMany({
        where: { rating: { lte: 2 }, comment: { not: null } },
        select: { comment: true, rating: true },
        take: 50,
      })
      const areaMap = new Map<string, { totalRating: number; count: number }>()
      for (const f of lowFeedback) {
        if (!f.comment) continue
        // Extract potential topics from low-rated feedback
        const topics = ['wait', 'slow', 'navigation', 'upload', 'response', 'unclear', 'complicated', 'error', 'broken']
        for (const topic of topics) {
          if (f.comment.toLowerCase().includes(topic)) {
            const existing = areaMap.get(topic) || { totalRating: 0, count: 0 }
            existing.totalRating += f.rating
            existing.count += 1
            areaMap.set(topic, existing)
          }
        }
      }
      for (const [area, data] of areaMap) {
        const avgScore = Math.round((data.totalRating / data.count) * 10) / 10
        improvementAreasData.push({
          category: area.charAt(0).toUpperCase() + area.slice(1),
          avgScore,
          severity: data.count >= 5 ? 'high' : 'medium',
          mentions: data.count,
          trend: -0.1 * data.count, // Negative trend proportional to mentions
        })
      }
    } catch { /* empty */ }

    let recentFeedbackData = []
    try {
      const feedback = await db.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { customer: true }
      })
      recentFeedbackData = feedback.map(f => ({
        id: f.id,
        name: f.customer?.nameEn || 'Anonymous',
        rating: f.rating,
        comment: f.comment,
        channel: f.channel,
        date: new Date(f.createdAt).toLocaleDateString(),
        sentiment: f.rating >= 4 ? 'positive' : f.rating >= 3 ? 'neutral' : 'negative'
      }))
    } catch (e) {
      // Ignored
    }

    return c.json({
      csatTrendData,
      channelCSATData,
      feedbackKeywords,
      improvementAreasData,
      recentFeedbackData
    })
  } catch (error) {
    console.error('Dashboard CSAT error:', error)
    return c.json({ error: 'Failed to fetch CSAT data' }, 500)
  }
})

// ─── Predictions Endpoint ──────────────────────────────────────────────────
// Provides AI-powered predictions for the executive dashboard and insights panels
// Response shape matches the frontend PredictionData interface
app.get('/dashboard/predictions', async (c) => {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    let totalInteractions = 0
    let activeCases = 0
    let agentsOnline = 0

    try {
      totalInteractions = await db.interaction.count({ where: { createdAt: { gte: todayStart } } }) || 0
      activeCases = await db.case.count({ where: { status: { in: ['open', 'in_progress'] } } }) || 0
      agentsOnline = await db.agent.count({ where: { status: 'available' } }) || 0
    } catch {
      // Ignore
    }

    // 1. Volume Forecast (Historical 24h as predicted)
    const volumeForecast: any[] = []
    try {
      const hourlyInteractions = await db.interaction.findMany({
        where: { createdAt: { gte: last24h } },
        select: { createdAt: true }
      })
      const hourCounts: Record<number, number> = {}
      for (const i of hourlyInteractions) {
        const h = i.createdAt.getHours()
        hourCounts[h] = (hourCounts[h] || 0) + 1
      }
      for (let i = 0; i < 24; i++) {
        volumeForecast.push({
          hour: `${String(i).padStart(2, '0')}:00`,
          predictedVolume: hourCounts[i] || 0,
          confidence: hourCounts[i] ? 90 : 0
        })
      }
    } catch {}

    // 2. Escalation Risks
    const escalationRisks: any[] = []
    let urgentCasesList: any[] = []
    try {
      const urgentCases = await db.case.findMany({
        where: { status: { in: ['open', 'in_progress'] }, OR: [{ priority: 'urgent' }, { sentiment: { lt: 0.3 } }] },
        include: { customer: true },
        take: 5
      })
      urgentCasesList = urgentCases
      urgentCases.forEach(c => {
        escalationRisks.push({
          caseId: c.id,
          title: c.titleEn,
          customerName: c.customer?.nameEn || 'Unknown',
          riskLevel: c.priority === 'urgent' ? 'high' : 'medium',
          riskReason: c.priority === 'urgent' ? 'Urgent priority case remains open' : 'Customer sentiment dropping',
          sentiment: c.sentiment,
          daysOpen: Math.round((Date.now() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
          caseRef: c.referenceNumber
        })
      })
    } catch {}

    // 3. Workforce Recommendation
    let recommendedStaffing = 0
    let predictedVolumeIncrease = 0
    try {
      const wfKpis = await db.dashboardKPI.findMany({
        where: { metric: { in: ['recommendedStaffing', 'predictedVolumeIncrease'] } },
        orderBy: { recordedAt: 'desc' },
        take: 10
      })
      for (const k of wfKpis) {
        if (k.metric === 'recommendedStaffing' && recommendedStaffing === 0) recommendedStaffing = k.value
        if (k.metric === 'predictedVolumeIncrease' && predictedVolumeIncrease === 0) predictedVolumeIncrease = k.value
      }
    } catch {}
    
    const workforceRecommendation = {
      currentStaffing: agentsOnline,
      currentOnline: agentsOnline,
      recommendedStaffing: recommendedStaffing || 0,
      peakHours: [],
      averageCasesPerAgent: agentsOnline > 0 ? Math.round((activeCases / agentsOnline) * 10) / 10 : 0,
      predictedVolumeIncrease: predictedVolumeIncrease || 0,
      suggestedAction: recommendedStaffing > agentsOnline ? 'Call in backup agents' : 'Staffing levels adequate',
    }

    // 4. Geo Distribution
    const geoDistribution: any[] = []
    try {
      const recentInteractionsWithCustomers = await db.interaction.findMany({
        where: { createdAt: { gte: last7Days } },
        include: { customer: true }
      })
      const emirateStats: Record<string, { count: number, sentimentSum: number }> = {}
      let totalGeoInteractions = 0
      for (const i of recentInteractionsWithCustomers) {
        if (i.customer?.emirate) {
          const em = i.customer.emirate
          if (!emirateStats[em]) emirateStats[em] = { count: 0, sentimentSum: 0 }
          emirateStats[em].count++
          emirateStats[em].sentimentSum += i.sentiment
          totalGeoInteractions++
        }
      }
      Object.keys(emirateStats).forEach(key => {
        const stats = emirateStats[key]
        geoDistribution.push({
          key,
          percentage: totalGeoInteractions > 0 ? Math.round((stats.count / totalGeoInteractions) * 100) : 0,
          interactions: stats.count,
          satisfaction: Math.round((stats.sentimentSum / stats.count) * 5 * 10) / 10,
          topService: 'N/A',
          avgResponseMin: 0
        })
      })
      geoDistribution.sort((a, b) => b.percentage - a.percentage)
    } catch {}

    // 5. Compliance Metrics
    const complianceMetrics = {
      score: 0,
      responseTimeSLA: 0,
      resolutionTimeSLA: 0,
      fcrTarget: 0,
      csatTarget: 0,
    }
    try {
      const compScores = await db.dashboardKPI.findMany({
        where: { metric: { in: ['complianceScore', 'responseTimeSLA', 'resolutionTimeSLA', 'fcrTarget', 'csatTarget'] } },
        orderBy: { recordedAt: 'desc' },
        take: 20
      })
      const compMap: Record<string, number> = {}
      for (const score of compScores) {
        if (compMap[score.metric] === undefined) compMap[score.metric] = score.value
      }
      complianceMetrics.score = compMap['complianceScore'] || 0
      complianceMetrics.responseTimeSLA = compMap['responseTimeSLA'] || 0
      complianceMetrics.resolutionTimeSLA = compMap['resolutionTimeSLA'] || 0
      complianceMetrics.fcrTarget = compMap['fcrTarget'] || 0
      complianceMetrics.csatTarget = compMap['csatTarget'] || 0
    } catch {}

    const channelPredictions: any[] = []
    const sentimentForecast: any[] = []
    const resolutionPredictions = { predictedFCR: 0, predictedAvgResolutionHours: 0, predictedCSAT: 0 }
    
    // Shifts
    const activeShifts = await db.agentShift.findMany({
      where: { endTime: null },
      include: { agent: true }
    })
    const shifts = activeShifts.map(s => ({
      agent: s.agent.name,
      start: s.startTime.getHours(),
      end: s.startTime.getHours() + 8,
      channel: s.channel
    }))

    // ---- AI GENERATION LOGIC ----
    const aiProvider = c.req.query('provider') || 'gemini'
    const model = aiProvider === 'gemini' ? 'gemini-2.5-flash' : 'zai-default'
    let isAIGenerated = false

    try {
      const { default: ZAI } = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.create()
      
      const systemPrompt = `You are an AI Data Analyst for the UAE Ministry of Energy & Infrastructure (MOEI). You analyze real-time support center metrics and output actionable insights as a strict JSON object. Do not wrap in markdown or backticks. Return ONLY raw JSON matching this structure:
{
  "volumeForecast": [ { "hour": "00:00", "predictedVolume": 5, "confidence": 90 } ],
  "escalationRisks": [ { "caseId": "xxx", "title": "xxx", "customerName": "xxx", "riskLevel": "high|medium|low", "riskReason": "xxx", "sentiment": 0.5, "daysOpen": 2 } ],
  "workforceRecommendation": {
    "currentStaffing": 0,
    "currentOnline": 0,
    "recommendedStaffing": 0,
    "peakHours": [ { "start": "10:00", "end": "14:00", "recommendedAgents": 0 } ],
    "averageCasesPerAgent": 0,
    "predictedVolumeIncrease": 0,
    "suggestedAction": "string"
  }
}`

      const userContext = `Current Time: ${now.toISOString()}
Total Interactions Today: ${totalInteractions}
Active Cases: ${activeCases}
Agents Online: ${agentsOnline}
Urgent Cases: ${JSON.stringify(urgentCasesList.map(c => ({ id: c.id, title: c.titleEn, sentiment: c.sentiment })))}
Historical 24h Volume Counts: ${JSON.stringify(volumeForecast)}
Current Recommended Staffing (KPI): ${recommendedStaffing}

Please generate the prediction JSON. Base your recommendations realistically on the active cases and agents online. Ensure 'volumeForecast' has 24 entries (one for each hour).`

      const result = await zai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContext }
        ]
      })

      const rawContent = result.choices?.[0]?.message?.content || result.content || ''
      const jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim()
      const aiData = JSON.parse(jsonStr)

      // Replace procedural arrays with AI generated ones
      if (aiData.volumeForecast && Array.isArray(aiData.volumeForecast)) {
        volumeForecast.splice(0, volumeForecast.length, ...aiData.volumeForecast)
      }
      if (aiData.escalationRisks && Array.isArray(aiData.escalationRisks)) {
        escalationRisks.splice(0, escalationRisks.length, ...aiData.escalationRisks)
      }
      if (aiData.workforceRecommendation) {
        Object.assign(workforceRecommendation, aiData.workforceRecommendation)
      }
      isAIGenerated = true
    } catch (aiErr) {
      console.error('AI Insights Generation Failed. Falling back to programmatic logic.', aiErr)
    }

    return c.json({
      volumeForecast,
      escalationRisks,
      workforceRecommendation,
      channelPredictions,
      sentimentForecast,
      resolutionPredictions,
      geoDistribution,
      complianceMetrics,
      shifts,
      generatedAt: now.toISOString(),
      confidence: isAIGenerated ? 0.95 : 1.0,
      isAIGenerated,
    })
  } catch (error) {
    console.error('Dashboard predictions GET error:', error)
    return c.json({ error: 'Failed to generate predictions' }, 500)
  }
})

export const dashboardRoutes = app
