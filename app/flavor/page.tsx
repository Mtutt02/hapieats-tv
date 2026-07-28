import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import FlavorShop from '@/components/flavor/FlavorShop'

export const metadata = { title: 'Flavor Points', description: 'Buy Flavor Points and send food-themed gifts to your favorite creators on HapiEats TV.' }

export default async function FlavorPage({
  searchParams,
}: {
  searchParams: { success?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/flavor')

  const { data: wallet } = await supabase
    .from('flavor_wallets')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Success banner */}
        {searchParams.success && (
          <div className="mb-8 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-center font-medium">
            🎉 Purchase successful! Your Flavor Points have been credited.
          </div>
        )}

        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🫙</div>
          <h1 className="text-3xl font-extrabold mb-2">Flavor Points</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Buy Flavor Points and send food-themed gifts to creators during live streams.
            Creators keep 50% of every gift.
          </p>
        </div>

        <FlavorShop initialBalance={wallet?.balance ?? 0} />
      </main>
    </AppShell>
  )
}
