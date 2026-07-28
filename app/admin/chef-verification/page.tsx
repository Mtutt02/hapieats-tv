import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ChefHat, ExternalLink, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AdminChefVerificationActions from '@/components/chef-verification/AdminChefVerificationActions'

export const metadata = {
  title: 'Chef Verification — Admin | HapiEats TV',
}

// Shapes returned from the join query
interface ApplicationRow {
  id: string
  status: string
  credential_type: string
  credential_detail: string
  portfolio_url: string | null
  social_proof: string | null
  additional_notes: string | null
  created_at: string
  reviewed_at: string | null
  denial_reason: string | null
  profiles: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

const CREDENTIAL_LABELS: Record<string, string> = {
  culinary_school: 'Culinary School',
  professional_cook: 'Professional Cook',
  restaurant_owner: 'Restaurant Owner',
  food_blogger: 'Food Blogger',
  certified_nutritionist: 'Certified Nutritionist',
  other: 'Other',
}

export default async function AdminChefVerificationPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/admin/chef-verification')

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'superadmin', 'moderator'].includes(profile.role)) {
    redirect('/')
  }

  // Fetch all pending applications with applicant info
  const { data: applications, error } = await supabase
    .from('chef_verification_applications')
    .select(`
      id,
      status,
      credential_type,
      credential_detail,
      portfolio_url,
      social_proof,
      additional_notes,
      created_at,
      reviewed_at,
      denial_reason,
      profiles!chef_verification_applications_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('admin chef_verification page error:', error)
  }

  const rows = (applications ?? []) as ApplicationRow[]

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <ChefHat className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chef Verification</h1>
            <p className="text-sm text-muted-foreground">
              Review and approve pending chef verification applications
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-500 px-3 py-1 text-sm font-medium">
            <Users className="h-3.5 w-3.5" />
            {rows.length} pending
          </span>
        </div>

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed p-16 text-center text-muted-foreground">
            <ChefHat className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No pending applications</p>
            <p className="text-sm mt-1">All caught up — no chef verifications waiting for review.</p>
          </div>
        )}

        {/* Applications table */}
        {rows.length > 0 && (
          <div className="space-y-4">
            {rows.map((app) => {
              const applicant = app.profiles
              const displayName = applicant?.display_name ?? applicant?.username ?? 'Unknown'

              return (
                <div
                  key={app.id}
                  className="rounded-2xl border bg-card overflow-hidden"
                >
                  {/* Applicant header */}
                  <div className="flex items-center gap-3 px-6 py-4 border-b bg-muted/30">
                    {applicant?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={applicant.avatar_url}
                        alt={displayName}
                        className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-500 font-semibold text-sm">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{displayName}</p>
                      {applicant?.username && (
                        <p className="text-xs text-muted-foreground">@{applicant.username}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0">
                      Submitted{' '}
                      {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                    </div>
                  </div>

                  {/* Application details */}
                  <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Credential Type
                        </p>
                        <span className="inline-flex rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-0.5 text-sm font-medium">
                          {CREDENTIAL_LABELS[app.credential_type] ?? app.credential_type}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Background
                        </p>
                        <p className="text-sm text-foreground">{app.credential_detail}</p>
                      </div>

                      {app.additional_notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Additional Notes
                          </p>
                          <p className="text-sm text-foreground">{app.additional_notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {app.portfolio_url && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Portfolio / Website
                          </p>
                          <a
                            href={app.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-amber-500 hover:text-amber-400 transition-colors break-all"
                          >
                            {app.portfolio_url}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                      )}

                      {app.social_proof && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Social Media
                          </p>
                          <p className="text-sm text-foreground">{app.social_proof}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                          Decision
                        </p>
                        <AdminChefVerificationActions
                          applicationId={app.id}
                          applicantName={displayName}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
