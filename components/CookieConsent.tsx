'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Consent model + helpers
// ---------------------------------------------------------------------------

export interface ConsentState {
  /** Strictly necessary cookies — always granted, cannot be disabled */
  necessary: true
  /** Vercel Analytics / Speed Insights + Mux Data */
  analytics: boolean
  /** ISO timestamp of when the choice was made */
  updatedAt: string
}

const STORAGE_KEY = 'he-cookie-consent'
export const CONSENT_CHANGED_EVENT = 'he-consent-changed'
export const OPEN_PREFS_EVENT = 'he-open-cookie-prefs'

// 12 months in seconds (365 days)
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Read the stored consent (localStorage). Returns null if no choice recorded. */
export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConsentState>
    if (typeof parsed.analytics !== 'boolean') return null
    return {
      necessary: true,
      analytics: parsed.analytics,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** Re-open the consent banner (e.g. from a "Cookie settings" footer link). */
export function openCookiePreferences(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_PREFS_EVENT))
}

function persistConsent(analytics: boolean): ConsentState {
  const consent: ConsentState = {
    necessary: true,
    analytics,
    updatedAt: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
  } catch {
    // localStorage unavailable (private mode etc.) — cookie below still persists
  }
  try {
    const value = encodeURIComponent(JSON.stringify(consent))
    document.cookie = `${STORAGE_KEY}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`
  } catch {
    // document.cookie unavailable — nothing else to do
  }
  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGED_EVENT, { detail: consent }))
  return consent
}

// ---------------------------------------------------------------------------
// Toggle (shadcn-style switch)
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange?: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
        checked ? 'bg-emerald-600' : 'bg-zinc-700'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const [analyticsChecked, setAnalyticsChecked] = useState(false)

  // On mount: show banner only if no consent recorded (never during render / SSR)
  useEffect(() => {
    const existing = getConsent()
    if (!existing) {
      setVisible(true)
    } else {
      setAnalyticsChecked(existing.analytics)
    }

    const handleOpen = () => {
      const current = getConsent()
      setAnalyticsChecked(current?.analytics === true)
      setShowPrefs(true)
      setVisible(true)
    }
    window.addEventListener(OPEN_PREFS_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_PREFS_EVENT, handleOpen)
  }, [])

  const close = useCallback(() => {
    setVisible(false)
    setShowPrefs(false)
  }, [])

  const acceptAll = useCallback(() => {
    persistConsent(true)
    setAnalyticsChecked(true)
    close()
  }, [close])

  const essentialOnly = useCallback(() => {
    persistConsent(false)
    setAnalyticsChecked(false)
    close()
  }, [close])

  const savePreferences = useCallback(() => {
    persistConsent(analyticsChecked)
    close()
  }, [analyticsChecked, close])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-[100] p-3 sm:p-4 md:bottom-0"
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-100">We use cookies</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          We use strictly necessary cookies to make HapiEats TV work, and optional analytics
          cookies (Vercel Analytics, Speed Insights and Mux Data) to understand how the site is
          used. See our{' '}
          <Link href="/cookies" className="underline underline-offset-2 text-zinc-200 hover:text-white">
            Cookie Policy
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 text-zinc-200 hover:text-white">
            Privacy Policy
          </Link>
          .
        </p>

        {showPrefs && (
          <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-100">Strictly necessary</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Required for sign-in, security and core features. Always on.
                </p>
              </div>
              <Toggle checked disabled label="Strictly necessary cookies (always on)" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-100">Analytics</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Vercel Analytics / Speed Insights and Mux Data video quality metrics.
                </p>
              </div>
              <Toggle
                checked={analyticsChecked}
                onChange={setAnalyticsChecked}
                label="Analytics cookies"
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={acceptAll}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={essentialOnly}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Essential only
          </button>
          {showPrefs ? (
            <button
              type="button"
              onClick={savePreferences}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Save preferences
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPrefs(true)}
              aria-expanded={showPrefs}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Preferences
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
