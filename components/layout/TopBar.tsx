'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { UploadCloud, LayoutDashboard, LogOut, Bell, UserCircle, Settings, Search, X, ArrowLeft, HelpCircle, Menu } from 'lucide-react'
import SearchBar from '@/components/search/SearchBar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Logo from './Logo'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

// TopBar height tokens — keep in sync with HomeClient sticky top offset
// Mobile: h-12 = 48px  |  sm+: h-14 = 56px
export const TOPBAR_H = { mobile: 'h-12', desktop: 'sm:h-14' }

export default function TopBar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const [user, setUser] = useState<User | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileSearchVal, setMobileSearchVal] = useState('')
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url, display_name, username')
          .eq('id', user.id)
          .single()
        if (data) {
          setAvatarUrl(data.avatar_url)
          setDisplayName(data.display_name ?? data.username ?? '')
          setUsername(data.username ?? '')
        }
      }
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const openMobileSearch = () => {
    setMobileSearchOpen(true)
    setTimeout(() => mobileInputRef.current?.focus(), 50)
  }

  const closeMobileSearch = () => {
    setMobileSearchOpen(false)
    setMobileSearchVal('')
  }

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = mobileSearchVal.trim()
    if (q.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(q)}`)
      closeMobileSearch()
    }
  }

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
      TOPBAR_H.mobile, TOPBAR_H.desktop
    )}>

      {/* ── Mobile search overlay ──────────────────────────────── */}
      <div
        className={cn(
          'md:hidden absolute inset-x-0 top-0 bg-background z-10 flex items-center gap-2 px-3',
          TOPBAR_H.mobile, TOPBAR_H.desktop,
          'transition-all duration-200',
          mobileSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none -translate-y-1'
        )}
      >
        <button
          onClick={closeMobileSearch}
          className="p-2 rounded-full hover:bg-accent text-muted-foreground transition-colors flex-shrink-0"
          aria-label="Close search"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <form onSubmit={handleMobileSearch} className="flex-1 relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={mobileInputRef}
            type="search"
            value={mobileSearchVal}
            onChange={(e) => setMobileSearchVal(e.target.value)}
            placeholder="Search food, creators, stations..."
            className="w-full pl-9 pr-10 py-2 text-sm rounded-full border border-border bg-muted/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          />
          {mobileSearchVal && (
            <button type="button" onClick={() => setMobileSearchVal('')} className="absolute right-3 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>

      {/* ── Main bar ───────────────────────────────────────────── */}
      <div className="h-full flex items-center gap-2 px-3 sm:px-4">

        {/* Hamburger — mobile only */}
        {onMenuOpen && (
          <button
            className="md:hidden p-2 -ml-1 rounded-xl hover:bg-accent text-muted-foreground transition-colors touch-manipulation flex-shrink-0"
            onClick={onMenuOpen}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Logo — icon + wordmark */}
        <Link href="/" className="flex items-center gap-1.5 flex-shrink-0" aria-label="HapiEats TV">
          <Logo size={24} />
          {/* Wordmark: hidden on very small screens, shown otherwise */}
          <span className="hidden xs:flex items-baseline leading-none">
            <span className="font-black text-sm tracking-tight text-cyan-400">HAPI</span>
            <span className="font-black text-sm tracking-tight text-white">EATS</span>
            <span className="font-black text-sm tracking-tight text-pink-500 italic ml-0.5">TV</span>
          </span>
        </Link>

        {/* Desktop search — grows in middle */}
        <div className="hidden md:flex flex-1 max-w-xl mx-auto">
          <SearchBar className="w-full" placeholder="Search food videos, creators, stations..." />
        </div>

        {/* Spacer on mobile */}
        <div className="flex-1 md:hidden" />

        {/* Right actions */}
        <div className="flex items-center gap-0.5 sm:gap-1">

          {/* Search icon — mobile only */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors touch-manipulation"
            onClick={openMobileSearch}
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {user ? (
            <>
              {/* Upload — desktop only */}
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex gap-1.5 text-sm">
                <Link href="/studio/upload">
                  <UploadCloud className="h-4 w-4" />
                  <span className="hidden lg:inline">Upload</span>
                </Link>
              </Button>

              {/* Notifications — desktop only */}
              <button className="hidden sm:flex p-2 rounded-full hover:bg-accent transition-colors" aria-label="Notifications">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Avatar dropdown — shown on all sizes */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background touch-manipulation ml-0.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-primary text-white text-xs font-bold">
                        {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2 text-sm font-medium truncate">{displayName}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${username}`} className="flex items-center gap-2 cursor-pointer">
                      <UserCircle className="h-4 w-4" /> Your Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/studio" className="flex items-center gap-2 cursor-pointer">
                      <UploadCloud className="h-4 w-4" /> Studio
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/faq" className="flex items-center gap-2 cursor-pointer">
                      <HelpCircle className="h-4 w-4" /> Help & FAQ
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            /* Signed-out: compact links, native-feeling */
            <div className="flex items-center gap-1">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-accent touch-manipulation"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold text-background bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-full transition-colors touch-manipulation"
              >
                Join
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
