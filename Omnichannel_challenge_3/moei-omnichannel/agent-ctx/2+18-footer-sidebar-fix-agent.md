# Task 2+18: Footer & Sidebar Fix Agent

## Task 2: Fix Footer to be sticky/static across all pages

### Problem
- When `viewportConstrained={true}` in MoeiPageLayout, the layout uses `h-dvh overflow-hidden`
- The full MoeiFooter (with links, contact info, etc.) was rendered inside this constrained viewport
- Since the admin dashboard fills the viewport with sidebar + content, the full footer was hidden/cut off

### Solution
1. Created a new `MoeiCompactFooter` component (`src/components/shared/layouts/moei-compact-footer.tsx`)
   - Slim bar (~28px tall) with gold accent line, government seal, copyright, and version
   - Always visible at the bottom of viewport-constrained layouts
   - Consistent with MOEI UAE government design system (gold accents, Shield icon)

2. Updated `MoeiPageLayout` (`src/components/shared/layouts/moei-page-layout.tsx`)
   - When `viewportConstrained=true`: renders `MoeiCompactFooter` (slim, always visible)
   - When `viewportConstrained=false`: renders full `MoeiFooter` with `mt-auto` and `shrink-0` (sticky at bottom)

### Files Changed
- NEW: `src/components/shared/layouts/moei-compact-footer.tsx`
- MODIFIED: `src/components/shared/layouts/moei-page-layout.tsx`

---

## Task 18: Remove horizontal scroll from sidebar

### Problem
- Sidebar had horizontal scrolling on some screen sizes
- When collapsed, text could overflow beyond the 68px width
- When expanded, text didn't truncate properly

### Solution
1. Added `md:overflow-hidden` to `motion.aside` container to prevent horizontal scroll
2. Added `overflow-hidden` and `min-w-0` to branding section container
3. Added `min-w-0` and `truncate` to agent name/role and MOEI branding text
4. Added `justify-center` to employer login/notification row for centered icons when collapsed
5. Added `overflow-hidden` and `min-w-0` to language toggle button container
6. Added width animation (`width: 0` → `width: auto`) to language toggle text (consistent with nav items)
7. Added `truncate` to language toggle text span
8. Added `shrink-0` to collapse toggle button
9. Added `min-w-0`, `overflow-hidden`, and `truncate` to desktop nav item label container
10. Added `shrink-0` to badge elements in nav items

### Files Changed
- MODIFIED: `src/components/layout/sidebar.tsx`
