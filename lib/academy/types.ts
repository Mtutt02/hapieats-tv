// ============================================================
// HapiEats Academy — Shared contracts
// Single source of truth for the classes/courses/academy
// system. Every Academy API route and UI component imports
// from here. Do not fork these shapes.
// ============================================================

// ---------- economics ----------

/** Share of net Pro subscription revenue that flows to the creator pool. */
export const PRO_POOL_PCT = 0.5
/** Standard creator split on individual (non-Pro) class purchases. */
export const CLASS_CREATOR_PCT = 0.8
export const CLASS_PLATFORM_PCT = 0.2
/** Platform fee on institution tuition (B2B2C). */
export const INSTITUTION_PLATFORM_PCT = 0.15
/** Pro membership price (USD/month). */
export const PRO_PRICE_USD = 12.99

/**
 * Engagement → pool credits. Watch minutes + a completion bonus, so
 * finished lessons are worth more than half-watched ones (ClassPass-style:
 * you're paid for real, completed consumption).
 */
export const CREDIT_PER_MINUTE = 1
export const CREDIT_COMPLETION_BONUS = 20
export function engagementCredits(minutes: number, completed: boolean): number {
  return minutes * CREDIT_PER_MINUTE + (completed ? CREDIT_COMPLETION_BONUS : 0)
}

// ---------- enums ----------

export type CourseFormat = 'recorded' | 'live' | 'hybrid'
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional'
export type PricingModel = 'free' | 'paid' | 'pro_only'
export type CredentialTier = 'completion' | 'skill' | 'diploma'
export type AssessmentType = 'quiz' | 'practical'
export type InstitutionRole = 'admin' | 'instructor' | 'student'

export const COURSE_CATEGORIES = [
  'baking', 'grilling', 'pastry', 'knife-skills', 'world-cuisine', 'plant-based',
  'wine-pairing', 'food-safety', 'restaurant-ops', 'nutrition', 'general',
] as const
export type CourseCategory = typeof COURSE_CATEGORIES[number]

// ---------- data shapes ----------

export interface Ingredient { item: string; qty?: string; unit?: string; note?: string }

export interface Recipe {
  id: string
  course_id: string
  lesson_id: string | null
  title: string
  is_master: boolean
  servings: number | null
  prep_minutes: number | null
  cook_minutes: number | null
  ingredients: Ingredient[]
  steps: string[]
  notes: string | null
}

export interface LessonResource { name: string; url: string; type?: string }
export interface Chapter { t: number; label: string }

export interface CourseLesson {
  id: string
  section_id: string
  title: string
  description: string | null
  video_id: string | null
  mux_playback_id?: string | null
  order_index: number
  is_free_preview: boolean
  duration: number | null
  resources: LessonResource[]
  chapters: Chapter[]
  recipe?: Recipe | null
}

export interface CourseSection {
  id: string
  course_id: string
  title: string
  order_index: number
  lessons: CourseLesson[]
}

export interface Course {
  id: string
  creator_id: string
  title: string
  slug?: string | null
  description: string | null
  category: CourseCategory | string
  format: CourseFormat
  level: CourseLevel
  pricing_model: PricingModel
  price: number
  pro_included: boolean
  issues_certificate: boolean
  certificate_tier: CredentialTier
  requires_assessment: boolean
  institution_id: string | null
  thumbnail_url: string | null
  estimated_minutes: number | null
  enrollment_count: number
  is_published: boolean
  created_at: string
}

// ---------- shopping list (derived from recipes) ----------

export interface ShoppingItem { key: string; item: string; qty: string; checked?: boolean }

/** Aggregate every recipe's ingredients into one de-duplicated shopping list. */
export function buildShoppingList(recipes: Recipe[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>()
  for (const r of recipes) {
    for (const ing of r.ingredients || []) {
      const key = ing.item.trim().toLowerCase()
      if (!key) continue
      const qty = [ing.qty, ing.unit].filter(Boolean).join(' ')
      if (map.has(key)) {
        const cur = map.get(key)!
        cur.qty = cur.qty ? `${cur.qty} + ${qty}`.trim() : qty
      } else {
        map.set(key, { key, item: ing.item.trim(), qty })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.item.localeCompare(b.item))
}

// ---------- API surface (namespace: /api/academy/*) ----------
//
// Courses:    GET/POST /api/academy/courses            · GET/PATCH/DELETE /api/academy/courses/[courseId]
// Sections:   POST /api/academy/courses/[courseId]/sections · PATCH/DELETE .../sections/[sectionId]
// Lessons:    POST .../sections/[sectionId]/lessons     · PATCH/DELETE .../lessons/[lessonId]
// Recipes:    PUT /api/academy/lessons/[lessonId]/recipe · GET /api/academy/courses/[courseId]/recipes
// Shopping:   GET/POST /api/academy/courses/[courseId]/shopping-list
// Enroll:     POST /api/academy/courses/[courseId]/enroll  (free | tokens | stripe | pro)
// Progress:   POST /api/academy/lessons/[lessonId]/progress { seconds, completed }
// Certificate:POST /api/academy/courses/[courseId]/certificate  → issues when complete
// Pro:        POST /api/academy/pro/subscribe · POST /api/academy/pro/cancel · GET /api/academy/pro/status
// Payout:     POST /api/academy/payout/run (cron/admin) — snapshots month, splits pool by credits
// AI idea:    POST /api/academy/ai-course-idea { topic?, level? } → { title, description, sections[], lessons[] }
// Cohorts:    POST /api/academy/cohorts · POST /api/academy/cohorts/[id]/join
// Institutions:POST /api/academy/institutions · GET /api/academy/institutions/[slug]
// Programs:   POST /api/academy/programs · POST /api/academy/programs/[id]/enroll
// Assessments:POST /api/academy/assessments · POST .../[id]/submit · POST .../submissions/[id]/grade
// Credentials:GET /api/academy/credentials/[code]  (public verify)
//
// Access rule everywhere: a user may view a paid course's full lessons if
// they are the creator, OR enrolled, OR (course.pro_included && is_pro_member).
// Free-preview lessons are always viewable.

export interface AiCourseIdea {
  title: string
  description: string
  category: string
  level: CourseLevel
  estimatedMinutes: number
  sections: { title: string; lessons: { title: string; summary: string; hasRecipe: boolean }[] }[]
}

export function verifyUrl(code: string): string {
  return `https://www.hapieatstv.com/verify/${code}`
}

export function certSerial(): string {
  return 'HE-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
}
