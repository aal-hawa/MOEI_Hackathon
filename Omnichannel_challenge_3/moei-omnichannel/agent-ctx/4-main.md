# Task 4: Department Services Page

## Summary
Created a comprehensive Department Services page that allows MOEI department staff to review, approve, or reject cases routed from the AI Brain / Call Center.

## Files Created
- `/home/z/my-project/src/pages/views/Departments.tsx` — Main view component (580+ lines)

## Files Modified
- `/home/z/my-project/src/pages/i18n/translations.ts` — Added 28 translation keys (en + ar) for department services
- `/home/z/my-project/src/app/page.tsx` — Added import and case for 'departments' view

## Key Features
- 8 MOEI departments (Energy, Infrastructure, Water, Housing, Petroleum, Transport, Digital Services, Sustainability)
- 14 realistic mock cases across departments
- Department grid view with cards showing pending/review counts
- Department detail view with status filter pills and search
- Approve/Reject workflow with required rejection reason dialog
- Case detail dialog with full info
- Full i18n support (Arabic RTL)
- MOEI gold color scheme (#92722A)
- Responsive layout with Framer Motion animations
- Uses MoeiPageLayout, shadcn/ui components

## Verification
- TypeScript compilation: PASS
- Dev server: Running (HTTP 200)
- No new lint errors
