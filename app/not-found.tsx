import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Home, Search, TrendingUp } from 'lucide-react'

export default function NotFound() {
  return (
    <AppShell>
      <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        {/* Big food emoji */}
        <div className="text-8xl mb-6">🍽️</div>

        {/* Error */}
        <h1 className="text-6xl font-black mb-2">
          <span className="text-cyan-400">4</span>
          <span className="text-white">0</span>
          <span className="text-pink-500">4</span>
        </h1>

        <p className="text-xl font-semibold mb-2">Page not found</p>
        <p className="text-muted-foreground max-w-md mb-8">
          Looks like this dish isn't on the menu. The page you're looking for may have moved
          or doesn't exist.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/" className="gap-2">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/trending" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Trending
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/search" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </Link>
          </Button>
        </div>
      </main>
    </AppShell>
  )
}
