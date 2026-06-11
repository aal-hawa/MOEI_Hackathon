# Task 5 - Power Plan Agent Work Record

## Task: Update MOEI seed script with customerProfileKey and ServiceRuleAction records

## Summary
Updated `/home/z/my-project/scripts/seed-moei-data.ts` with three changes:

### Change 1: customerProfileKey on FieldDef and field definitions
- Added `customerProfileKey?: string` to FieldDef interface
- Set customerProfileKey on 10 common reusable fields (emiratesId, nameEn, phone, propertyOwned, propertyType, emirate, addressEn, familyBookNum, monthlyIncome, nationality)
- Set `customerProfileKey: ''` on 30+ service-specific inline fields

### Change 2: ServiceRuleAction definitions and seeding
- Created ActionDef interface (actionType, endpoint?, payloadTemplate?, sortOrder)
- Added `actions?: ActionDef[]` to ServiceRuleDef interface
- Defined actions for all 13 service rules (24 total actions)
- Added seedServiceRuleActions() function
- Called from main() after seedServiceRules()

### Change 3: customerProfileKey passed to DB
- Added `customerProfileKey: fieldDef.customerProfileKey || ''` to both create/update paths

## Verification Results
- 13 ServiceRules, 85 Fields (51 with customerProfileKey), 24 Actions seeded
- Script is idempotent (verified by running twice)
- All profile key mappings verified in DB
- All 24 actions verified with correct types and endpoints
