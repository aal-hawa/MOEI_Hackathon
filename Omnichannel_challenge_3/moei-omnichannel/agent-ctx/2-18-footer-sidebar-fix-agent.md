# Task 2-18: Fix Footer sticky + Remove sidebar horizontal scroll

## Task 1: Fix Footer to be sticky/static across ALL pages

### Changes Made:
1. **`src/components/shared/layouts/moei-compact-footer.tsx`**: Added `mt-auto` to footer className alongside existing `shrink-0`. This ensures the compact footer always sticks to the bottom in the viewport-constrained (admin) flex column layout.

2. **`src/components/shared/layouts/moei-footer.tsx`**: Added `shrink-0` to footer className alongside existing `mt-auto`. Previously `shrink-0` was only passed via the className prop from MoeiPageLayout. Now it's built-in so the footer never gets squeezed in any layout context.

3. **`src/components/shared/layouts/moei-page-layout.tsx`**: Removed redundant `className="shrink-0"` prop from `MoeiFooter` since `shrink-0` is now built into the component itself.

### CSS Pattern:
- `viewportConstrained=true` (admin): `h-dvh overflow-hidden flex flex-col` → main is `flex-1`, compact footer has `shrink-0 mt-auto`
- `viewportConstrained=false` (other pages): `min-h-screen flex flex-col` → main is `flex-1`, full footer has `shrink-0 mt-auto`
- Both patterns ensure footer sticks to viewport bottom when content is short, and naturally pushes down when content is tall

## Task 2: Remove horizontal scroll from sidebar

### Changes Made:
1. **`src/pages/views/Admin.tsx`**: Added `overflow-hidden` to the parent div wrapping Sidebar. This prevents the sidebar width animation (68px ↔ 256px) from causing a horizontal scrollbar during the transition.
   - Before: `className="flex flex-1 h-full min-h-0"`
   - After: `className="flex flex-1 h-full min-h-0 overflow-hidden"`

2. **`src/components/layout/sidebar.tsx`**: Added `overflow-x-hidden` to the nav element to prevent any horizontal scroll from nav items, on both desktop and mobile.
   - Desktop: `overflow-y-auto overflow-x-hidden` (vertical scroll still works, no horizontal scroll)
   - Mobile: `max-md:overflow-x-hidden` (no horizontal scroll on bottom nav bar)

### Key Points:
- The sidebar already had `md:overflow-hidden` on the `motion.aside` element for desktop
- The root cause was the parent container in Admin.tsx lacking `overflow-hidden` during the width animation
- The sidebar collapse/expand still works via the `<` / `>` toggle button at the bottom
- Mobile bottom nav bar no longer has any horizontal scroll

## Lint Status:
All modified files pass lint with no errors or warnings.
