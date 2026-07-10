'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Home, Radio, Rss, TrendingUp, Tv, BookOpen, GraduationCap,
  UploadCloud, Clapperboard, LayoutDashboard, DollarSign,
  Wallet, Target, Coins, Trophy, Settings, HelpCircle,
  BadgeDollarSign, X, ChevronDown, Zap, ShieldCheck,
} from 'lucide-react'
import Logo from './Logo'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  exact?: boolean
}

// ── Nav sections ──────────────────────────────────────────────────────────────

const ALWAYS_VISIBLE: NavItem[] = [
  { href: '/',      icon: Home,  label: 'Home',     exact: true },
  { href: '/clips', icon: Clapperboard, label: 'Clips' },
  { href: '/live',  icon: Radio, label: 'Live'  },
  { href: '/stations', icon: Rss, label: 'Stations' },
]

const DISCOVER_ITEMS: NavItem[] = [
  { href: '/tv',       icon: Tv,         label: 'Watch TV'  },
  { href: '/trending', icon: TrendingUp, label: 'Trending'  },
]

const LEARN_ITEMS: NavItem[] = [
  { href: '/courses', icon: BookOpen,      label: 'Courses' },
  { href: '/classes', icon: GraduationCap, label: 'Classes' },
]

const CREATE_ITEMS: NavItem[] = [
  { href: '/studio/upload',   icon: UploadCloud,     label: 'Upload'      },
  { href: '/studio/go-live',  icon: Zap,             label: 'Go Live'     },
  { href: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard'   },
  { href: '/studio',          icon: Clapperboard,    label: 'Studio'      },
  { href: '/creator/courses', icon: BookOpen,        label: 'My Courses'  },
]

const EARN_ITEMS: NavItem[] = [
  { href: '/dashboard/monetize', icon: DollarSign, label: 'Monetize'       },
  { href: '/creator/wallet',     icon: Wallet,     label: 'Creator Wallet' },
  { href: '/creator/goals',      icon: Target,     label: 'My Goals'       },
]

const ACCOUNT_ITEMS: NavItem[] = [
  { href: '/tokens',         icon: Coins,           label: 'Hapi Tokens'   },
  { href: '/flavor',         icon: Coins,           label: 'Flavor Points' },
  { href: '/challenges',     icon: Trophy,          label: 'Challenges'    },
  { href: '/studio/credits', icon: BadgeDollarSign, label: 'My Credits'    },
]

// ── Nav link ──────────────────────────────────────────────────────────────────

function NavLink({ item, onClose, indent = false }: { item: NavItem; onClose?: () => void; indent?: boolean }) {
  const pathname = usePathname()
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 touch-manipulation',
        indent ? 'ml-2 pl-3' : '',
        isActive
          ? 'bg-primary/12 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground active:scale-[0.98]'
      )}
    >
      <Icon className={cn(
        'h-4 w-4 flex-shrink-0',
        isActive ? 'text-primary' : ''
      )} />
      <span className="truncate">{item.label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
    </Link>
  )
}

// ── Collapsible section ────────────────────────────────────────────────────────

function NavSection({
  label,
  icon: SectionIcon,
  items,
  onClose,
  defaultOpen = false,
}: {
  label: string
  icon: React.ElementType
  items: NavItem[]
  onClose?: () => void
  defaultOpen?: boolean
}) {
  const pathname = usePathname()
  // Auto-open if any child is active
  const hasActive = items.some(i => (i.exact ? pathname === i.href : pathname.startsWith(i.href)))
  const [open, setOpen] = useState(hasActive || defaultOpen)

  // Re-expand when navigating into a child
  useEffect(() => {
    if (hasActive) setOpen(true)
  }, [pathname, hasActive])

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 touch-manipulation',
          hasActive
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        )}
      >
        <SectionIcon className={cn('h-4 w-4 flex-shrink-0', hasActive ? 'text-primary' : '')} />
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown className={cn(
          'h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 text-muted-foreground',
          open && 'rotate-180'
        )} />
      </button>

      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {items.map(item => (
            <NavLink key={item.href} item={item} onClose={onClose} indent />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let alive = true
    const loadRole = async (userId: string | null) => {
      if (!userId) { if (alive) setIsStaff(false); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
      if (alive) setIsStaff(['admin', 'superadmin', 'moderator'].includes(data?.role ?? ''))
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
      loadRole(user?.id ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setIsLoggedIn(!!s?.user)
      loadRole(s?.user?.id ?? null)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full py-4 px-3 gap-0.5">

      {/* Logo + close */}
      <div className="flex items-center justify-between px-3 py-2 mb-3">
        <Link href="/" onClick={onClose} className="flex items-center gap-2" aria-label="HapiEats TV">
          <Logo size={28} />
          <span className="flex items-baseline leading-none">
            <span className="font-black text-sm tracking-tight text-cyan-400">HAPI</span>
            <span className="font-black text-sm tracking-tight text-white">EATS</span>
            <span className="font-black text-sm tracking-tight text-pink-500 italic ml-1">TV</span>
          </span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Always-visible top links */}
      <nav className="flex flex-col gap-0.5">
        {ALWAYS_VISIBLE.map(item => (
          <NavLink key={item.href} item={item} onClose={onClose} />
        ))}
        {isStaff && (
          <NavLink item={{ href: '/admin', icon: ShieldCheck, label: 'Admin Dashboard' }} onClose={onClose} />
        )}
      </nav>

      <div className="my-2 border-t border-border/60" />

      {/* Collapsible: Discover + Learn */}
      <nav className="flex flex-col gap-0.5">
        <NavSection label="Discover" icon={Tv}         items={DISCOVER_ITEMS} onClose={onClose} />
        <NavSection label="Learn"    icon={GraduationCap} items={LEARN_ITEMS} onClose={onClose} />
      </nav>

      {/* Creator sections — logged-in only */}
      {isLoggedIn && (
        <>
          <div className="my-2 border-t border-border/60" />

          <p className="px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">
            Creator
          </p>
          <nav className="flex flex-col gap-0.5">
            <NavSection label="Create" icon={UploadCloud} items={CREATE_ITEMS} onClose={onClose} />
            <NavSection label="Earn"   icon={DollarSign}  items={EARN_ITEMS}   onClose={onClose} />
          </nav>

          <div className="my-2 border-t border-border/60" />

          <p className="px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">
            Account
          </p>
          <nav className="flex flex-col gap-0.5">
            <NavSection label="My Economy" icon={Coins} items={ACCOUNT_ITEMS} onClose={onClose} />
            <NavLink item={{ href: '/settings', icon: Settings, label: 'Settings' }} onClose={onClose} />
            <NavLink item={{ href: '/faq',      icon: HelpCircle, label: 'Help & FAQ' }} onClose={onClose} />
          </nav>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="px-3 pt-2 border-t border-border/40">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/50">
          {[
            ['/about',            'About'     ],
            ['/faq',              'FAQ'       ],
            ['/terms',            'Terms'     ],
            ['/privacy',          'Privacy'   ],
            ['/cookies',          'Cookies'   ],
            ['/dmca',             'DMCA'      ],
            ['/guidelines',       'Guidelines'],
            ['/creator-agreement','Creators'  ],
          ].map(([href, label]) => (
            <Link key={href} href={href} onClick={onClose} className="hover:text-muted-foreground transition-colors">
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('he-open-cookie-prefs'))}
            className="hover:text-muted-foreground transition-colors"
          >
            Cookie preferences
          </button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/30">© 2026 HapiEats TV</p>
      </div>
    </div>
  )
}
