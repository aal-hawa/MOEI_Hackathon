# Task: Update Team Insights Components with Real Backend Data

## Summary

Updated three Team Insights components to show real data from backend APIs instead of empty arrays.

## Changes Made

### 1. Backend: `/agents/performance` endpoint
**File:** `/home/z/my-project/src/worker/routes/agents.ts`

Added new `GET /agents/performance` route that:
- Fetches all agents from the DB
- For each agent, counts resolved cases (where `assignedAgent = agent.email` and `status = 'resolved'`)
- Counts active cases (open/in_progress)
- Computes avg resolution time from resolved cases with timestamps
- Computes avg response time by comparing first inbound/outbound interactions per case
- Computes CSAT from feedback related to the agent's cases
- Returns agents sorted by `casesResolved` descending

### 2. AgentSkillsMatrix component
**File:** `/home/z/my-project/src/pages/components/agent/skills-matrix.tsx`

- Fetches agents from `/api/agents?XTransformPort=3002`
- Parses each agent's `skills` JSON field
- Maps skill keys from DB (e.g., `electricity_water`, `housing`, `petroleum`) to translation keys
- Computes skill proficiency level based on percentage of agents who have each skill
- Shows agent count per skill (e.g., "1/3 agents")
- Auto-expands when data is available
- Handles loading and empty states
- Shows skill gap indicators for skills below 80% proficiency

### 3. MultilangQueue component
**File:** `/home/z/my-project/src/pages/components/agent/multilang-queue.tsx`

- Fetches agents from `/api/agents?XTransformPort=3002` for available agents per language
- Fetches conversations from `/api/conversations?XTransformPort=3002` for customer language distribution
- Parses each agent's `languages` JSON field and counts available (non-offline) agents per language
- Counts conversations per language from the sessions data
- Shows language queue bars with real queue percentages
- Shows available agents per language and bilingual agent count
- Detects language gaps (more customers than agents)
- Auto-expands when data is available

### 4. PerformanceLeaderboard component
**File:** `/home/z/my-project/src/pages/components/agent/performance-leaderboard.tsx`

- Fetches agents with performance from `/api/agents/performance?XTransformPort=3002`
- Ranks agents by `casesResolved` (with `activeCases` as fallback)
- Shows agent initials, display name, resolved cases count, avg response time, CSAT rating
- Uses `useAppStore` for `currentAgent` to highlight the current user in the leaderboard
- Generates sparkline data from performance metrics with trend indicators
- Shows top performer in footer summary
- Auto-expands when data is available
- Added max-h-96 overflow for long agent lists

### 5. Translation keys added
**File:** `/home/z/my-project/src/pages/i18n/translations.ts`

Added translation keys for both English and Arabic:
- Skill levels: `beginner`, `intermediate`, `advanced`, `expert`
- Additional languages: `french`, `urdu`, `hindi`, `tagalog`

## Verification
- All 4 modified files pass lint checks with zero errors
- Backend performance endpoint returns valid data (tested via curl)
- Dev server running with no errors
- Pre-existing lint errors in other files are unrelated to these changes
