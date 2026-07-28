'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function AppShell({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
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
          <div className={fullWidth ? '' : 'pb-16 md:pb-0'}>
            {children}
          </div>
        </main>

        {/* ── Mobile bottom nav ─────────────────────────────────── */}
        <BottomNav />
      </div>
    </div>
  )
}
