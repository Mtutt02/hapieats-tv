'use client'

import type { ReactNode } from 'react'
import { themeVars } from '@/lib/academy/theme'

interface ThemedShellProps {
  theme?: unknown
  children: ReactNode
  className?: string
}

/**
 * Wraps microsite content and injects the institution's validated theme as
 * inline CSS variables (--brand-primary / --brand-accent / --brand-font).
 * All values pass through sanitizeTheme, so no arbitrary CSS can be injected.
 * Descendants read the vars via Tailwind arbitrary values, e.g.
 *   bg-[var(--brand-primary)]  text-[var(--brand-accent)]
 *   style={{ fontFamily: 'var(--brand-font)' }}
 */
export default function ThemedShell({ theme, children, className }: ThemedShellProps) {
  const vars = themeVars(theme) as Record<string, string>
  return (
    <div
      style={{ ...vars, fontFamily: 'var(--brand-font)' }}
      className={className}
    >
      {children}
    </div>
  )
}
