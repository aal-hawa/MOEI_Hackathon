# Task 2-3: Schema + Orchestrator Agent

## Task: Update Prisma schema and create BrainOrchestrator

## Work Completed

### Task 2: Prisma Schema Updates

1. **Added `customerProfileKey` to `ServiceRuleField`** (line 311 in schema.prisma)
   - Type: `String? @default("")`
   - Purpose: Maps a service rule field to a customer profile field (e.g., "emiratesId" → customer.emiratesId, "fullName" → customer.nameEn)
   - Placed after `fieldKey` field as specified

2. **Added `ServiceRuleAction` model** (lines 556-568 in schema.prisma)
   - Placed before STTTranscript model
   - Fields: id, ruleId, actionType, endpoint, payloadTemplate, sortOrder, isActive, createdAt, updatedAt
   - Cascade relation to ServiceRule via ruleId

3. **Added `actions ServiceRuleAction[]` relation to `ServiceRule`** (line 276)
   - Placed alongside existing `fields ServiceRuleField[]` relation

### Task 3: BrainOrchestrator

Created `/home/z/my-project/src/worker/lib/brain-orchestrator.ts` (318 lines)

**BEFORE phase (prepares context):**
- `loadCustomerProfile()` - loads full customer with cases, serviceRequests, bills
- Language detection delegated to SmartBrain.detectLanguage()
- Passes everything to SmartBrain.think()

**AFTER phase (executes actions):**
- If actionReady && matchedRule: loads ServiceRuleActions from DB and executes dynamically
- Dynamic dispatch for 4 action types:
  - `CREATE_RECORD` - Creates Case with reference number + ServiceRequest if service found
  - `UPDATE_STATUS` - Updates case status by ID, reference number, or latest open case
  - `SEND_EMAIL` - Placeholder (log only)
  - `API_CALL` - Placeholder (log only)

**Exports:**
- `OrchestratorInput` interface
- `OrchestratorResult` interface (with actionResults, customerId, channelId)
- `BrainOrchestrator` object with `handleMessage()` method

**Utilities:**
- `generateReferenceNumber()` - MOEI-{CATEGORY}-{YEAR}-{XXXX} format
- `resolvePayloadTemplate()` - Substitutes {{fieldKey}} placeholders

## Verification
- `bun run db:push` succeeded - database synced
- Prisma Client verified: ServiceRuleAction table exists, customerProfileKey field exists, actions relation works
- BrainOrchestrator module imports verified
- Lint: no new errors introduced
