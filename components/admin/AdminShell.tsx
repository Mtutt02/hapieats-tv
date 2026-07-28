'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import AdminSidebar from './AdminSidebar'

interface AdminShellProps {
  role: string
  displayName: string
  children: React.ReactNode
}

export default function AdminShell({ role, displayName, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <div className="hidden md:block">
        <AdminSidebar role={role} displayName={displayName} />
      </div>

      {/* ── Mobile sidebar overlay ──────────────────────── */}
      {sidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="md:hidden fixed left-0 top-0 h-full z-50">
            <AdminSidebar role={role} displayName={displayName} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* ── Main content ────────────────────────────────── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-card sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm text-primary uppercase tracking-wider">
            {role === 'moderator' ? 'Mod Panel' : 'Admin Panel'}
          </span>
          <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">{displayName}</span>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
