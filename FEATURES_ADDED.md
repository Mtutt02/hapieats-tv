# HapiEats TV — New Food-Platform Features

## 1. Recipe Cards on Videos (HIGH PRIORITY)

### Files added / changed
| File | What |
|---|---|
| `supabase/migrations/20260701_recipe_cards.sql` | Creates `recipe_cards` table, `tried_this` table, and `is_verified_chef` column on `profiles`. RLS policies included. |
| `app/api/recipe/route.ts` | GET `?video_id=` (public) and POST (auth-gated, creator must own video). Upserts one recipe per video. |
| `components/recipe/RecipeCard.tsx` | Display component: header with cuisine tag, stats row (prep/cook/total time, servings, calories), difficulty + dietary badges, two-column ingredient/step layout. Uses dark theme throughout. |
| `app/(viewer)/watch/[videoId]/page.tsx` | Imports and renders `RecipeCard` below the video description. Fetches recipe server-side using service client. |

### How it works
- Creators POST to `/api/recipe` with `video_id`, ingredients (`[{amount, unit, item}]`), steps (`[{step, instruction}]`), dietary_tags, etc.
- The watch page fetches the recipe server-side and conditionally renders `RecipeCard`.
- If no recipe exists the section is simply absent — zero visual clutter.

---

## 2. Cuisine & Dietary Tags Filter Bar (HIGH PRIORITY)

### Files added / changed
| File | What |
|---|---|
| `components/filters/CuisineTags.tsx` | Horizontal scrollable pill bar with 14 tags: Italian, Mexican, Asian, Indian, American, Mediterranean, BBQ, Desserts, Vegan, Gluten-Free, Keto, Quick, Date Night, Meal Prep. Accepts either a controlled `onSelect` prop or falls back to URL `?cuisine=` param. |
| `components/home/HomeClient.tsx` | Imports `CuisineTags` and renders it in the sticky header strip below the existing category pills. Active cuisine state is held locally. |

---

## 3. Cooking Time Filter on Home Page (MEDIUM)

### Files changed
| File | What |
|---|---|
| `components/home/HomeClient.tsx` | Adds a `COOK_TIME_FILTERS` constant (Any Time / Quick <30m / Medium 30-60m / Long >60m) and a row of pill buttons in the sticky filter strip, right of the cuisine tags. State managed client-side. |

The cook-time filter state is wired up visually; server-side filtering requires recipe_cards data on feed queries — which can be added as a follow-up once recipe adoption grows.

---

## 4. "Tried This" Reaction (MEDIUM)

### Files added / changed
| File | What |
|---|---|
| `supabase/migrations/20260701_recipe_cards.sql` | `tried_this` table: `video_id`, `user_id`, unique constraint, RLS. |
| `app/api/videos/[videoId]/tried/route.ts` | POST — toggles tried status for the current user, returns `{ tried, triedCount }`. |
| `components/video/TriedThisButton.tsx` | Client component matching `LikeButton`'s UX: optimistic update, 401 → redirect to login, amber/orange active state with checkmark icon and count badge. |
| `app/(viewer)/watch/[videoId]/page.tsx` | Button is shown in the actions row **only when the video has a recipe card** (purposeful: it's a food action, not a generic reaction). |

---

## 5. Chef Verification Badge (MEDIUM)

### Files added / changed
| File | What |
|---|---|
| `supabase/migrations/20260701_recipe_cards.sql` | `ALTER TABLE profiles ADD COLUMN is_verified_chef boolean DEFAULT false` |
| `components/badges/VerifiedChefBadge.tsx` | Two display modes: `showLabel=false` (icon + tooltip, used inline with creator names) and `showLabel=true` (pill with "Verified Chef" text, used on profile headers). Orange primary color. |
| `app/(viewer)/watch/[videoId]/page.tsx` | Queries `is_verified_chef` from profiles, shows badge next to creator name in the creator info card. |
| `app/profile/[username]/page.tsx` | Queries `is_verified_chef`, shows `VerifiedChefBadge showLabel` next to the profile display name. |

---

## Summary of all new files

```
supabase/migrations/20260701_recipe_cards.sql
app/api/recipe/route.ts
app/api/videos/[videoId]/tried/route.ts
components/recipe/RecipeCard.tsx
components/video/TriedThisButton.tsx
components/filters/CuisineTags.tsx
components/badges/VerifiedChefBadge.tsx
```

## Files modified

```
app/(viewer)/watch/[videoId]/page.tsx   — RecipeCard, TriedThisButton, VerifiedChefBadge wired in
app/profile/[username]/page.tsx         — VerifiedChefBadge on profile header
components/home/HomeClient.tsx          — CuisineTags + cooking time filter strip added
```

## To activate in Supabase

```bash
supabase db push
# or run the migration file directly in the SQL editor
```

After the migration runs, creators can POST recipe cards via `/api/recipe` and the watch page will automatically show the card + "Tried This" button.
