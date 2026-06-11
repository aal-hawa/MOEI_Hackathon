# Task 6: Refactor chat.ts to use BrainOrchestrator as a thin wrapper

## Agent: Power Plan Agent

## Summary
Successfully refactored `/home/z/my-project/src/worker/routes/chat.ts` from ~331 lines to ~155 lines (53% reduction) by replacing direct SmartBrain calls and duplicated business logic with a single `BrainOrchestrator.handleMessage()` call.

## What Changed

### Removed (now handled by BrainOrchestrator)
- `mapIntentToServiceCategory()` — hardcoded intent→category mapping
- `generateReferenceNumber()` — reference number generation
- Direct customer context loading from DB (lines 73-99)
- Direct `SmartBrain.think()` call (line 104)
- Auto-creation of ServiceRequests, Cases
- Direct email confirmation sending
- EmployerNotification creation
- ConversationSession update with caseId/serviceRequestId

### Kept (channel-specific concerns)
- Input validation and sanitization
- Interaction record saving (inbound + outbound)
- ConversationSession management (create/update)
- Session customer creation
- Reference number extraction from action results for response enrichment
- HTTP response building

### New
- Import of `BrainOrchestrator` and `OrchestratorResult` type
- Single `BrainOrchestrator.handleMessage()` call replaces all business logic
- Reference number extraction from `result.actionResults` using regex on `action.details`
- `matchedRule` and `actionResults` included in API response when available

## Verification
- `bun run lint` — no new errors from chat.ts (8 pre-existing errors in ChatPage.tsx remain)
- Dev server running fine on port 3000
