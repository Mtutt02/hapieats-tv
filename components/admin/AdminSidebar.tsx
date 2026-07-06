'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Video, Flag, Settings,
  ShieldCheck, Shield, LogOut, BarChart2, ClipboardList, X, BadgeDollarSign, Crown, Wallet, Tv,
} from 'lucide-react'
import Logo from '@/components/layout/Logo'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AdminSidebarProps {
  role: string
  displayName: string
  onClose?: () => void
}

// Full admin nav (admin + superadmin)
const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/tv-lineup',    label: 'TV Lineup',     icon: Tv              },
  { href: '/admin/moderation', label: 'Moderation', icon: ClipboardList },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/videos', label: 'Videos', icon: Video },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/admin/credits',       label: 'Credits',       icon: BadgeDollarSign },
  { href: '/admin/monetization',  label: 'Monetization',  icon: Wallet          },
  { href: '/admin/settings',      label: 'Settings',      icon: Settings        },
]

// Superadmin-only nav
const SUPERADMIN_NAV = [
  { href: '/admin/superadmin', label: 'Superadmin Dashboard', icon: Crown, exact: true },
]

// Moderator-only nav (limited)
const MOD_NAV = [
  { href: '/admin/moderator',  label: 'Dashboard',         icon: LayoutDashboard, exact: true  },
  { href: '/admin/moderation', label: 'Moderation Queue',  icon: ClipboardList,   exact: false },
  { href: '/admin/reports',    label: 'Reports',            icon: Flag                          },
  { href: '/admin/videos',     label: 'Videos',             icon: Video                         },
]

export default function AdminSidebar({ role, displayName, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isModerator = role === 'moderator'
  const navItems = isModerator ? MOD_NAV : ADMIN_NAV

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleBadge = {
    superadmin: { label: 'Super Admin', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    admin:      { label: 'Admin',       color: 'bg-primary/10 text-primary border-primary/20' },
    moderator:  { label: 'Moderator',   color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  }[role] ?? { label: role, color: 'bg-muted text-muted-foreground border-border' }

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-card border-r border-border flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
        <Logo size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-primary uppercase tracking-wider">
            {isModerator ? 'Mod Panel' : 'Admin Panel'}
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">{displayName}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground ml-auto">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Role badge */}
      <div className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${roleBadge.color}`}>
          {role === 'superadmin' ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
          {roleBadge.label}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}

        {/* Superadmin-only section */}
        {role === 'superadmin' && (
          <>
            <div className="pt-3 pb-1">
              <p className="px-3 text-[10px] font-bold text-purple-400/70 uppercase tracking-widest">Superadmin</p>
            </div>
            {SUPERADMIN_NAV.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-purple-500/15 text-purple-400 font-medium'
                      : 'text-purple-400/70 hover:bg-purple-500/10 hover:text-purple-300'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          ← Back to Site
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
