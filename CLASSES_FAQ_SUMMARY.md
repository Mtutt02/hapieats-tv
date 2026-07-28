# HapiEats TV — Classes & FAQ Build Summary

## What Was Audited and Built

---

## TASK A: Paid Classes Flow Audit & Fixes

### Audit Findings

The paid classes infrastructure was substantially complete. The following existed and were working correctly:

| Component | Status |
|-----------|--------|
| `/classes` browse page | ✅ Complete — filters, grid, live featured section |
| `/classes/[classId]` detail page | ✅ Complete — curriculum, instructor section, access gating |
| `ClassCard` component | ✅ Complete |
| `EnrollButton` component | ✅ Complete (with bug, see below) |
| `GET /api/classes` | ✅ Complete with filters/pagination |
| `POST /api/classes` | ✅ Complete — creates class, verifies channel ownership |
| `GET/PATCH /api/classes/[classId]` | ✅ Complete |
| `POST /api/classes/[classId]/enroll` | ✅ Complete — free enrollment path |
| `POST /api/classes/[classId]/enroll/checkout` | ✅ Complete — Stripe checkout session |
| `GET/POST /api/classes/[classId]/lessons` | ✅ Complete — access gating for non-enrolled users |
| Stripe webhook (`checkout.session.completed`) | ✅ Complete — grants enrollment on payment |
| `/studio/classes` creator management page | ✅ Complete |
| `/studio/classes/new` create class form | ✅ Complete |

### Bugs Found & Fixed

#### Bug 1: Price displayed wrong in EnrollButton
**File:** `components/classes/EnrollButton.tsx`  
**Problem:** Used `Intl.NumberFormat.format(price)` treating the price as dollars. The DB stores prices in **cents** (e.g., 999 = $9.99), so a $9.99 class was showing as "Enroll for $999.00".  
**Fix:** Replaced with `formatCurrency(price)` from `@/lib/utils`, which correctly divides by 100.

#### Bug 2: Stripe checkout multiplied cents by 100 again
**File:** `app/api/classes/[classId]/enroll/checkout/route.ts`  
**Problem:** The comment said "DB stores as dollars, Stripe needs cents" and the code did `Math.round(cls.price * 100)`. But the DB stores cents (the create form sends `price * 100`). So a 999-cent ($9.99) class was creating a Stripe charge of 99,900 cents = $999.  
**Fix:** Changed `unit_amount: Math.round(cls.price * 100)` to `unit_amount: Math.round(cls.price)` — cents pass directly to Stripe.

#### Note on CreateClassForm price comment
The code in `CreateClassForm.tsx` already correctly sends `price * 100` (dollar input converted to cents). Updated the inline comment to clarify this to avoid future confusion.

### New Files Created

#### `app/api/classes/[classId]/lessons/[lessonId]/route.ts`
PATCH and DELETE endpoints for individual lessons. Verifies instructor ownership before allowing edits/deletion.

#### `components/creator/EditClassClient.tsx`
Client component providing the full class edit UI:
- Edit class details (title, category, type, skill level, description, thumbnail URL, price, scheduled date, published status)
- Lesson curriculum manager: add lessons, toggle free preview status, delete lessons
- Instant save feedback (success/error states)
- Preview Page link opens class detail in a new tab

#### `app/(creator)/studio/classes/[classId]/edit/page.tsx`
Server component that:
- Authenticates the creator and verifies they own the class
- Fetches class + lessons from Supabase
- Renders breadcrumb (`Studio / Classes / [title]`) + `EditClassClient`

The studio classes table already linked to `/studio/classes/[id]/edit` — this page was the missing piece that made those Edit buttons functional.

---

## TASK B: FAQ Page

### New Files Created

#### `app/faq/page.tsx`
Full accordion-style FAQ page with 7 sections and 27 Q&A entries:

- **Getting Started** — What is HapiEats TV, account creation, free vs paid, differentiation from YouTube
- **Watching & Discovering Content** — Search, Stations, Classes, Watch Later
- **Flavor Points** — What they are, how to earn, what to spend on, expiration policy
- **Live Streaming & Tokens** — Token purchase, sending gifts, creator earnings from live, gift types
- **For Creators** — Becoming a creator, monetization streams, Verified Chef badge, applying for verification, how classes work, platform fee breakdown
- **Subscriptions & Payments** — How subscriptions work, accepted payment methods, cancellation, refund policy
- **Safety & Community** — Reporting content, Community Guidelines, blocking/muting

Design details:
- Accordion: one item open at a time, smooth chevron rotation
- Section headers in orange/primary color with uppercase tracking
- Links within answers route to relevant pages (`/classes`, `/flavor`, `/live`, `/stations`, `/dashboard`, etc.)
- Dark theme cards with `bg-card` + `border-border`
- Footer CTA links to `/contact`
- Mobile-friendly (stacked, full-width)

#### `app/faq/layout.tsx`
Provides `Metadata` for the FAQ page (since the page itself is a client component and can't export metadata directly):
```
title: 'FAQ | HapiEats TV'
description: 'Answers to common questions...'
```

### Modified Files

#### `components/layout/Sidebar.tsx`
- Added `HelpCircle` icon import
- Added `{ href: '/faq', icon: HelpCircle, label: 'Help & FAQ' }` to `USER_NAV` (visible to logged-in users under Account section)
- Added `<Link href="/faq">FAQ</Link>` to the footer link row (visible to all users at bottom of sidebar)

#### `components/layout/TopBar.tsx`
- Added `HelpCircle` import
- Added "Help & FAQ" `DropdownMenuItem` in the user avatar dropdown (between Settings and Sign out)

---

## Remaining Gaps / Future Work

1. **Lesson video linking:** When adding a lesson in the edit UI, instructors paste a video UUID manually. A better UX would be a video picker that shows the creator's uploaded videos from the Studio. The API supports `video_id` — the UI just needs a picker component.

2. **Lesson reordering:** The edit UI shows a drag handle (GripVertical icon) but drag-and-drop reordering is not wired up. Would require a library like `@dnd-kit/core` and a `PATCH /lessons/[lessonId]` call to update `order_index`.

3. **Class thumbnail upload:** The edit form accepts a thumbnail URL (paste link). A file upload UI backed by Supabase Storage or an image CDN would be more creator-friendly.

4. **Stripe webhook: enrollment_count increment:** When the webhook grants a class enrollment via `class_enrollments.upsert`, the `classes.enrollment_count` column is not auto-incremented. This requires either a Supabase DB trigger on `class_enrollments` INSERT, or a manual `UPDATE classes SET enrollment_count = enrollment_count + 1` call in the webhook handler.

5. **Lesson progress tracking:** The `class_enrollments` table has a `progress_lesson_id` column, but there is no UI to mark lessons as complete or resume from the last watched lesson. A "Mark Complete" button per lesson and a progress bar on the class detail page would close this gap.

6. **Watch page for enrolled lessons:** Currently the class detail page lists lessons but clicking a lesson doesn't navigate anywhere. A `/classes/[classId]/lessons/[lessonId]` watch page with the Mux player would complete the viewing flow.
