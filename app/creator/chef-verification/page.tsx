import { redirect } from 'next/navigation'
import { ChefHat, Clock, XCircle, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ChefVerificationForm from '@/components/chef-verification/ChefVerificationForm'
import VerifiedChefBadge from '@/components/chef-verification/VerifiedChefBadge'

const CREDENTIAL_LABELS: Record<string, string> = {
  culinary_school: 'Culinary School Graduate',
  professional_cook: 'Professional Cook / Head Chef',
  restaurant_owner: 'Restaurant Owner / Operator',
  food_blogger: 'Established Food Blogger / Creator',
  certified_nutritionist: 'Certified Nutritionist',
  other: 'Other Culinary Background',
}

export const metadata = {
  title: 'Chef Verification — HapiEats TV',
  description: 'Apply for a Verified Chef badge on HapiEats TV',
}

export default async function ChefVerificationPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/creator/chef-verification')
  }

  // Get profile + verification status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_verified_chef, is_creator, display_name, username')
    .eq('id', user.id)
    .single()

  // Get application if exists
  const { data: application } = await supabase
    .from('chef_verification_applications')
    .select('id, status, credential_type, credential_detail, created_at, reviewed_at, denial_reason')
    .eq('user_id', user.id)
    .maybeSingle()

  const isVerified = profile?.is_verified_chef ?? false
  const appStatus = application?.status

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <ChefHat className="h-5 w-5 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Chef Verification</h1>
          </div>
          <p className="text-muted-foreground">
            Get a Verified Chef badge on your profile — showing viewers you&apos;re a legitimate
            culinary professional vetted by HapiEats TV.
          </p>
        </div>

        {/* State: Already Verified */}
        {isVerified && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8">
            <div className="flex flex-col items-center text-center gap-4">
              <ChefHat className="h-14 w-14 text-amber-500" />
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  You&apos;re a Verified Chef!
                </h2>
                <p className="text-muted-foreground mb-4">
                  Your culinary credentials have been reviewed and approved by the HapiEats TV team.
                </p>
                <VerifiedChefBadge size="lg" />
              </div>
              <div className="w-full rounded-xl bg-background/60 border p-4 text-left text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground mb-2">What your badge means:</p>
                <p>• Your profile shows the orange chef hat badge</p>
                <p>• Viewers can trust you&apos;re a legitimate culinary professional</p>
                <p>• Your videos are prioritized in culinary search results</p>
                <p>• You appear in the &quot;Verified Chefs&quot; creator directory</p>
              </div>
            </div>
          </div>
        )}

        {/* State: Pending Review */}
        {!isVerified && appStatus === 'pending' && (
          <div className="rounded-2xl border border-amber-500/20 bg-card p-8">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Application Under Review
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  We&apos;ve received your application and our team is reviewing it. You&apos;ll
                  typically hear back within{' '}
                  <span className="text-foreground font-medium">3–5 business days</span>.
                </p>
                <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-36 flex-shrink-0">Credential type:</span>
                    <span className="text-foreground font-medium">
                      {CREDENTIAL_LABELS[application.credential_type] ?? application.credential_type}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-36 flex-shrink-0">Background:</span>
                    <span className="text-foreground">{application.credential_detail}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-36 flex-shrink-0">Submitted:</span>
                    <span className="text-foreground">
                      {new Date(application.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State: Denied */}
        {!isVerified && appStatus === 'denied' && (
          <div className="rounded-2xl border border-destructive/20 bg-card p-8">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Application Not Approved
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Unfortunately, we were unable to verify your culinary credentials at this time.
                </p>
                {application.denial_reason && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-4 mb-4">
                    <p className="text-sm font-medium text-foreground mb-1">Reason:</p>
                    <p className="text-sm text-muted-foreground">{application.denial_reason}</p>
                  </div>
                )}
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="font-medium text-foreground mb-2">Want to appeal?</p>
                  <p className="text-muted-foreground mb-3">
                    If you believe this decision was made in error or you have additional
                    documentation to provide, you can reach out to our team.
                  </p>
                  <a
                    href="mailto:verification@hapieats.tv?subject=Chef%20Verification%20Appeal"
                    className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-400 font-medium transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    Email verification@hapieats.tv
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State: No Application — Show Form */}
        {!isVerified && !appStatus && (
          <div className="space-y-6">
            {/* What qualifies */}
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold text-foreground mb-3">Who qualifies?</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  Culinary school graduates (Le Cordon Bleu, CIA, etc.)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  Professional cooks with significant kitchen experience
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  Restaurant owners, operators, or executive chefs
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  Established food content creators with a proven audience
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  Certified nutritionists with culinary focus
                </li>
              </ul>
            </div>

            {/* The Form */}
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold text-foreground mb-1">Apply for Verification</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Fill out the form below. We review all applications within 3–5 business days.
              </p>
              <ChefVerificationForm />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
