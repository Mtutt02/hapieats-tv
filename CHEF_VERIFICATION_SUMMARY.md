# Verified Chef Badge System — Build Summary

## What Was Built

### 1. DB Migration
**`supabase/migrations/20260701_chef_verification.sql`**
- Adds `is_verified_chef boolean DEFAULT false` and `role text` columns to `profiles`
- Creates `chef_verification_applications` table with all required fields, CHECK constraints, and UNIQUE (user_id)
- Row-Level Security: users see/submit their own; admins/moderators see all; admins/superadmins can update
- Triggers `set_chef_verification_updated_at` and indexes on `user_id` + `status`

### 2. Server Utility
**`lib/supabase/server.ts`** — already existed, confirmed it has both `createClient()` and `createServiceClient()`

### 3. API Routes

**`app/api/chef-verification/apply/route.ts`** — POST
- Auth required; checks `is_creator=true` OR at least 1 video uploaded
- Validates `credential_type` against enum, `credential_detail` required and ≤500 chars
- Inserts application; returns 409 on duplicate

**`app/api/chef-verification/status/route.ts`** — GET
- Auth required
- Returns `{ is_verified_chef, application }` where application includes status, dates, denial_reason

**`app/api/admin/chef-verification/route.ts`** — GET + PATCH
- Role check: must be `admin` or `superadmin`
- GET: returns all pending applications joined with `profiles` (username, display_name, avatar_url)
- PATCH: `{ applicationId, action: 'approve'|'deny', denialReason? }`
  - approve → sets application `status='approved'` + `profiles.is_verified_chef=true` via service client
  - deny → sets `status='denied'` + `denial_reason`
  - Guards against double-review (409 if already reviewed)

### 4. Components

**`components/chef-verification/VerifiedChefBadge.tsx`**
- Reusable badge: orange chef hat icon + "Verified Chef" label
- Sizes: `sm`, `md`, `lg`; `showLabel` prop for icon-only mode
- Amber-on-dark styling with border

**`components/chef-verification/ChefVerificationForm.tsx`** (client)
- Dropdown for credential type (6 options)
- Textarea for culinary background (500 char limit with counter)
- Input for portfolio URL (optional)
- Input for social handle (optional)
- Textarea for additional notes (optional)
- Submits to `/api/chef-verification/apply`; shows success card on completion

**`components/chef-verification/AdminChefVerificationActions.tsx`** (client)
- Approve button (green) + Deny button (red) per application row
- Deny expands an inline denial reason textarea before confirming
- Calls `/api/admin/chef-verification` PATCH; calls `router.refresh()` on success

### 5. Pages

**`app/creator/chef-verification/page.tsx`** (server component)
- **Verified state**: Congratulations panel with badge display, explains what badge means
- **Pending state**: Review in-progress panel with application summary (type, background, submitted date)
- **Denied state**: Denial reason shown + mailto appeal link to `verification@hapieats.tv`
- **No application**: "Who qualifies?" info panel + full application form

**`app/admin/chef-verification/page.tsx`** (server component)
- Admin/superadmin/moderator only — redirects others
- Lists all pending applications as cards
- Each card: applicant avatar + name/username, credential type badge, background text, portfolio link (opens new tab), social handle, additional notes
- `AdminChefVerificationActions` mounted per card for approve/deny

### 6. Sidebar

**`components/Sidebar.tsx`** (new — was absent from project)
- Logo, main nav (Home, Browse, Creators)
- Creator section (behind `isCreator` prop): Dashboard, Videos, Upload, Analytics, Earnings, **Chef Verification** with optional verified badge icon, Settings
- Admin section (behind `isAdmin` prop): Users, **Chef Verification**, Admin Settings
- Active link highlighting; receives `isVerifiedChef` prop to show badge indicator in nav

## Integration Notes

- The Sidebar accepts `isCreator`, `isAdmin`, `isVerifiedChef` as props — wire these from your layout by reading the user's profile
- The `role` column added to `profiles` uses CHECK constraint with values: `user`, `creator`, `moderator`, `admin`, `superadmin`
- Run `supabase db push` to apply the migration before deploying
- Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env.local` if not already present (used by service client for cross-user profile updates)
- The `VerifiedChefBadge` component can be placed on any profile page, video card, or channel header to display verified status

## File Tree

```
supabase/migrations/
  20260701_chef_verification.sql

app/
  api/
    chef-verification/
      apply/route.ts
      status/route.ts
    admin/
      chef-verification/route.ts
  creator/
    chef-verification/page.tsx
  admin/
    chef-verification/page.tsx

components/
  Sidebar.tsx
  chef-verification/
    VerifiedChefBadge.tsx
    ChefVerificationForm.tsx
    AdminChefVerificationActions.tsx
```
