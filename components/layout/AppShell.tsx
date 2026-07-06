'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Rss, GraduationCap, UploadCloud, Radio } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { cn } from '@/lib/utils'

const BOTTOM_NAV = [
  { href: '/',              label: 'Home',     Icon: Home,          exact: true  },
  { href: '/stations',      label: 'Stations', Icon: Rss,           exact: false },
  { href: '/live',          label: 'Live',     Icon: Radio,         exact: false },
  { href: '/classes',       label: 'Classes',  Icon: GraduationCap, exact: false },
  { href: '/studio/upload', label: 'Upload',   Icon: UploadCloud,   exact: false },
]

export default function AppShell({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[--sidebar-w] border-r border-border bg-background z-40 overflow-y-auto">
        <Sidebar />
      </aside>

      {/* ── Mobile sidebar drawer ──────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="md:hidden fixed left-0 top-0 h-full w-[280px] bg-background z-[60] overflow-y-auto border-r border-border shadow-2xl">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-[var(--sidebar-w)] flex flex-col min-h-screen min-w-0">
        <TopBar onMenuOpen={() => setMobileOpen(true)} />

        {/* Page content — bottom padding for mobile bottom nav */}
        <main className="flex-1">
          <div className={fullWidth ? '' : 'pb-20 md:pb-0'}>
            {children}
          </div>
        </main>

        {/* ── Mobile bottom nav ─────────────────────────────────── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex justify-around items-center py-1">
            {BOTTOM_NAV.map(({ href, label, Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[56px] touch-manipulation',
                    isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
                  )}
                >
                  <div className="relative">
                    <Icon className={cn('h-5 w-5 transition-all', isActive && 'stroke-[2.5px]')} />
                    {isActive && (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                    )}
                  </div>
                  <span className={cn('text-[10px] font-medium transition-colors', isActive ? 'text-primary' : '')}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
