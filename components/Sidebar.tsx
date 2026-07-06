'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Play,
  Users,
  DollarSign,
  Settings,
  Upload,
  LayoutDashboard,
  ChefHat,
  Shield,
  Film,
  BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import VerifiedChefBadge from '@/components/chef-verification/VerifiedChefBadge'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: React.ReactNode
}

interface SidebarProps {
  isCreator?: boolean
  isAdmin?: boolean
  isVerifiedChef?: boolean
}

const mainNav: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Browse', href: '/browse', icon: Play },
  { label: 'Creators', href: '/creators', icon: Users },
]

const creatorNav = (isVerifiedChef: boolean): NavItem[] => [
  { label: 'Dashboard', href: '/creator', icon: LayoutDashboard },
  { label: 'My Videos', href: '/creator/videos', icon: Film },
  { label: 'Upload', href: '/studio/upload', icon: Upload },
  { label: 'Analytics', href: '/creator/analytics', icon: BarChart2 },
  { label: 'Earnings', href: '/creator/earnings', icon: DollarSign },
  {
    label: 'Chef Verification',
    href: '/creator/chef-verification',
    icon: ChefHat,
    badge: isVerifiedChef ? (
      <VerifiedChefBadge size="sm" showLabel={false} />
    ) : undefined,
  },
  { label: 'Settings', href: '/creator/settings', icon: Settings },
]

const adminNav: NavItem[] = [
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Chef Verification', href: '/admin/chef-verification', icon: ChefHat },
  { label: 'Admin Settings', href: '/admin/settings', icon: Settings },
]

function NavSection({ title, items }: { title?: string; items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <div className="space-y-0.5">
      {title && (
        <p className="px-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2 mt-4">
          {title}
        </p>
      )}
      {items.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge}
          </Link>
        )
      })}
    </div>
  )
}

export default function Sidebar({ isCreator = false, isAdmin = false, isVerifiedChef = false }: SidebarProps) {
  return (
    <aside className="w-60 flex-shrink-0 bg-background border-r h-full flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Play className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">HapiEats TV</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <NavSection items={mainNav} />

        {isCreator && (
          <NavSection title="Creator Studio" items={creatorNav(isVerifiedChef)} />
        )}

        {isAdmin && (
          <NavSection title="Admin" items={adminNav} />
        )}
      </nav>

      {/* Admin badge */}
      {isAdmin && (
        <div className="px-4 py-3 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-amber-500" />
            <span>Admin access</span>
          </div>
        </div>
      )}
    </aside>
  )
}
