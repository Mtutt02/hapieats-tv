'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { getConsent, CONSENT_CHANGED_EVENT, type ConsentState } from '@/components/CookieConsent'

/**
 * Renders children (analytics scripts) ONLY after the user has opted in to
 * analytics cookies. Renders nothing on the server and nothing before consent,
 * so no non-essential scripts load prior to opt-in (GDPR).
 */
export default function ConsentGate({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    // Initial read after mount — never touches localStorage during render/SSR
    setAllowed(getConsent()?.analytics === true)

    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<ConsentState>).detail
      setAllowed(detail?.analytics === true)
    }
    window.addEventListener(CONSENT_CHANGED_EVENT, handleChange)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handleChange)
  }, [])

  if (!allowed) return null
  return <>{children}</>
}
