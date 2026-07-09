'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Clapperboard, Radio, Tv, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/',         label: 'Home',    Icon: Home,         exact: true  },
  { href: '/clips',    label: 'Clips',   Icon: Clapperboard, exact: false },
  { href: '/live',     label: 'Live',    Icon: Radio,        exact: false },
  { href: '/tv',       label: 'Shows',   Icon: Tv,           exact: false },
  { href: '/settings', label: 'Profile', Icon: UserCircle,   exact: false },
]

// Immersive routes where the bar must not render:
// - /studio/editor (full-screen editor)
// - /live/[id] full-screen rooms (but NOT the /live index)
const HIDDEN_ROUTES: RegExp[] = [
  /^\/studio\/editor(\/|$)/,
  /^\/live\/[^/]+/,
]

export default function BottomNav() {
  const pathname = usePathname()

  if (HIDDEN_ROUTES.some((re) => re.test(pathname))) return null

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="flex items-center py-1">
        {NAV_ITEMS.map(({ href, label, Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors touch-manipulation',
                isActive ? 'text-emerald-400' : 'text-muted-foreground active:text-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5 transition-all', isActive && 'stroke-[2.5px]')} />
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
                )}
              </div>
              <span className={cn('text-[10px] font-medium transition-colors', isActive ? 'text-emerald-400' : '')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
