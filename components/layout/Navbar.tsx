'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { UploadCloud, LayoutDashboard, LogOut, LogIn, Search, GraduationCap, UserCircle, Settings } from 'lucide-react'
import SearchBar from '@/components/search/SearchBar'
import { Button } from '@/components/ui/button'
import Logo from './Logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [username, setUsername] = useState<string>('')
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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="HapiEats TV">
          <Logo size={32} />
          <span className="hidden sm:flex items-baseline gap-0 leading-none">
            <span className="font-black text-xl tracking-tight text-cyan-400">HAPI</span>
            <span className="font-black text-xl tracking-tight text-white">EATS</span>
            <span className="font-black text-xl tracking-tight text-pink-500 italic ml-1">TV</span>
          </span>
        </Link>

        {/* Nav links — desktop */}
        <nav className="hidden md:flex items-center gap-1 mx-4">
          <Link href="/classes" className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-accent transition-colors">
            <GraduationCap className="h-4 w-4" />
            Classes
          </Link>
        </nav>

        {/* Search — desktop */}
        <div className="hidden md:flex flex-1 max-w-sm mx-4">
          <SearchBar className="w-64 xl:w-80" placeholder="Search food videos..." />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Search icon — mobile only */}
          <Link
            href="/search"
            className="md:hidden p-2 rounded-full hover:bg-accent transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>
          {user ? (
            <>
              <Button asChild variant="outline" size="sm" className="hidden sm:flex gap-2">
                <Link href="/studio/upload">
                  <UploadCloud className="h-4 w-4" />
                  Upload
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-primary text-white">
                        {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2 text-sm font-medium truncate">{displayName}</div>
                  <DropdownMenuSeparator />
                  {username && (
                    <DropdownMenuItem asChild>
                      <Link href={`/profile/${username}`} className="flex items-center gap-2 cursor-pointer">
                        <UserCircle className="h-4 w-4" /> Your Profile
                      </Link>
                    </DropdownMenuItem>
                  )}
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="gap-2">
                <Link href="/register">
                  <LogIn className="h-4 w-4" /> Get started
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
