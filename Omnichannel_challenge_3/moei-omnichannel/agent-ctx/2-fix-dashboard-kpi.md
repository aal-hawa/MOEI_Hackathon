# Task 2: Fix Dashboard KPI Data Issues

## Summary
Fixed multiple issues causing the Agent Dashboard to show "--" for KPIs and "Unknown" for customer names.

## Changes Made

### Backend: `/home/z/my-project/src/worker/routes/realtime.ts`
- Fixed `computeKPIs()` to properly compute `firstContactResolution` using `db.interaction.groupBy()` instead of hardcoding 0
- Added `totalConversations` from `db.conversationSession.count()`
- Added `activeNow` from `db.conversationSession.count({ where: { status: 'active' } })`
- Added `channelBreakdown` by grouping conversation sessions by channel

### Backend: `/home/z/my-project/src/worker/routes/conversations.ts`
- Added `customerName` and `customerNameAr` top-level fields to GET / response (from nested customer object)

### Frontend: `/home/z/my-project/src/pages/components/agent/agent-dashboard.tsx`
- Fixed KPIStatsRow: `avgResponseTime` no longer divides by 60 (API already returns minutes)
- Fixed CSAT display: shows "X/5" format instead of "X%", or "N/A" when 0
- Fixed resolutionRate and escalationRate: shows "N/A" instead of "--" when 0
- Fixed activeNow: uses API value `kpiData.activeNow`
- Fixed totalConversations: uses API value `kpiData.totalConversations`
- Fixed AgentPerformanceBar: same avgResolutionTime /60 division bug
- Fixed RecentActivityCard: customerName now falls back to `conv.customer?.nameEn` / `conv.customer?.nameAr`

### i18n: `/home/z/my-project/src/pages/i18n/translations.ts`
- Added 13 missing keys (en + ar): activeNow, aiModeDistribution, aiAssistedConversations, avgAiConfidence, noConversationSessions, channelDistribution, sentimentOverview, recentActivity, noRecentActivity, totalAnalyzed, overallPositive, overallNegative, overallNeutral
