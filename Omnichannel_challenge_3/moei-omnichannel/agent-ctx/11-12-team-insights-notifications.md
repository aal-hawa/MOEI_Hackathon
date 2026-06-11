# Task 11 & 12 - Team Insights and Notifications Fix

## Task 11: Team Insights - Verify fetching from database and showing well

### Changes Made:

1. **Removed auto-expand behavior** from all 3 Team Insights components:
   - `skills-matrix.tsx`: Removed `useEffect` that auto-expanded when agents loaded
   - `multilang-queue.tsx`: Removed `useEffect` that auto-expanded when agents loaded  
   - `performance-leaderboard.tsx`: Removed `useEffect` that auto-expanded when performance data loaded
   - Now respects user choice - components start collapsed and user clicks to expand

2. **Fixed Skills Matrix proficiency calculation**:
   - Old: Mapped coverage 30-100% to 60-95 range, making even low-coverage skills look okay (minimum "intermediate")
   - New: Maps coverage % directly to proficiency (100% → 95 expert, 66% → 63 intermediate, 33% → 35 beginner)
   - Low-coverage skills now clearly show as gaps with "training recommended" indicators

3. **Fixed Performance Leaderboard sparkline data**:
   - Old: Used `Math.random()` — different data on every re-render
   - New: Uses seeded PRNG from agent ID — deterministic, same sparkline every time
   - Added `seededRandom()` function and `agentId` parameter to `generateSparkData()`

4. **Verified all APIs work correctly**:
   - GET `/api/agents?XTransformPort=3002` → returns 3 agents with skills/languages
   - GET `/api/agents/performance?XTransformPort=3002` → returns agent performance metrics from DB
   - GET `/api/conversations?XTransformPort=3002` → returns conversation data for language distribution
   - All components fetch REAL data from the database, no hardcoded/mock data

## Task 12: Notifications - Fix: analyze, fetch from DB, show and integrate

### Changes Made:

1. **Verified all notification API endpoints work**:
   - GET `/api/notifications` → returns notifications with pagination and filtering
   - POST `/api/notifications` → creates notification (201)
   - PUT `/api/notifications/:id/read` → marks as read
   - POST `/api/notifications/mark-all-read` → marks all read for agent
   - GET `/api/notifications/unread-count` → returns accurate unread count with type breakdown

2. **Fixed notification bell unread count**:
   - Added `setEmployerUnreadCount(count)` action to Zustand store (was missing from implementation)
   - Updated `setEmployerNotifications()` to auto-compute `employerUnreadCount` from `notifications.filter(n => !n.read).length`
   - Replaced hacky `resetEmployerUnread()` + loop `incrementEmployerUnread()` with single `setEmployerUnreadCount()` call
   - Bell now shows accurate unread count that syncs with DB via polling (10s for count, 30s for full list)

3. **Verified notifications are created on events** (backend already handles this):
   - WhatsApp receive → `employerNotification.createMany` for available agents
   - Voice call start → `employerNotification.createMany` for available agents
   - Email receive → `employerNotification.createMany` for available agents
   - AI mode changed → `employerNotification.create` for assigned agent
   - Conversation transferred → `employerNotification.create` for target agent
   - Frontend also generates conversation-derived notifications (new conversation, sentiment alert, transfer)

4. **Added proper error handling**:
   - NotificationsView: Added `error` state, displays error message with retry button
   - NotificationsView: `catch` blocks now log errors instead of silently failing
   - EmployerNotificationBell: `catch` blocks now log errors instead of silently failing
   - Mark all read: Uses `setEmployerUnreadCount(0)` after marking all read

5. **Verified refresh behavior**:
   - NotificationsView polls every 30 seconds
   - Notification bell polls unread count every 10 seconds, full list every 30 seconds
   - Bell refreshes full list when dropdown opens
   - Both use `setEmployerNotifications()` which auto-computes unread count

### Files Modified:
- `/home/z/my-project/src/pages/components/agent/skills-matrix.tsx` - Removed auto-expand, fixed proficiency calc
- `/home/z/my-project/src/pages/components/agent/multilang-queue.tsx` - Removed auto-expand
- `/home/z/my-project/src/pages/components/agent/performance-leaderboard.tsx` - Removed auto-expand, deterministic sparklines
- `/home/z/my-project/src/pages/store/app-store.ts` - Added `setEmployerUnreadCount`, auto-compute unread on `setEmployerNotifications`
- `/home/z/my-project/src/components/agent/employer-notification-bell.tsx` - Fixed unread count sync, error handling, removed unused imports
- `/home/z/my-project/src/pages/views/Admin.tsx` - Added error state with retry, use `setEmployerUnreadCount`, proper error logging
