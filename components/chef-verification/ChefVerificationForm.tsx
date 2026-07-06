'use client'

import { useState } from 'react'
import { ChefHat, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CREDENTIAL_OPTIONS = [
  { value: 'culinary_school', label: 'Culinary School Graduate' },
  { value: 'professional_cook', label: 'Professional Cook / Head Chef' },
  { value: 'restaurant_owner', label: 'Restaurant Owner / Operator' },
  { value: 'food_blogger', label: 'Established Food Blogger / Creator' },
  { value: 'certified_nutritionist', label: 'Certified Nutritionist' },
  { value: 'other', label: 'Other Culinary Background' },
]

export default function ChefVerificationForm() {
  const [credentialType, setCredentialType] = useState('')
  const [credentialDetail, setCredentialDetail] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [socialProof, setSocialProof] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!credentialType) {
      setError('Please select a credential type.')
      return
    }
    if (!credentialDetail.trim()) {
      setError('Please describe your culinary background.')
      return
    }
    if (credentialDetail.length > 500) {
      setError('Background description must be 500 characters or fewer.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/chef-verification/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential_type: credentialType,
          credential_detail: credentialDetail.trim(),
          portfolio_url: portfolioUrl.trim() || null,
          social_proof: socialProof.trim() || null,
          additional_notes: additionalNotes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Application Submitted!</h3>
        <p className="text-muted-foreground">
          We&apos;ve received your chef verification application. Our team will review it within{' '}
          <span className="text-foreground font-medium">3–5 business days</span>. We&apos;ll notify
          you by email once a decision has been made.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Credential Type */}
      <div className="space-y-2">
        <Label htmlFor="credential-type">
          Credential Type <span className="text-destructive">*</span>
        </Label>
        <Select value={credentialType} onValueChange={setCredentialType}>
          <SelectTrigger id="credential-type" className="w-full">
            <SelectValue placeholder="Select your culinary background..." />
          </SelectTrigger>
          <SelectContent>
            {CREDENTIAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Credential Detail */}
      <div className="space-y-2">
        <Label htmlFor="credential-detail">
          Tell us about your culinary background <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="credential-detail"
          value={credentialDetail}
          onChange={(e) => setCredentialDetail(e.target.value)}
          placeholder='e.g. "Le Cordon Bleu Paris, 2018. Worked as sous chef at Nobu NYC for 4 years before launching my food channel."'
          className="min-h-[120px] resize-y"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground text-right">
          {credentialDetail.length}/500 characters
        </p>
      </div>

      {/* Portfolio URL */}
      <div className="space-y-2">
        <Label htmlFor="portfolio-url">Portfolio / Website URL (optional)</Label>
        <Input
          id="portfolio-url"
          type="url"
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          placeholder="https://yourwebsite.com"
        />
        <p className="text-xs text-muted-foreground">Your blog, restaurant website, or professional portfolio</p>
      </div>

      {/* Social Proof */}
      <div className="space-y-2">
        <Label htmlFor="social-proof">Social Media Handle (optional)</Label>
        <Input
          id="social-proof"
          value={socialProof}
          onChange={(e) => setSocialProof(e.target.value)}
          placeholder="@yourhandle on Instagram, YouTube, TikTok, etc."
        />
        <p className="text-xs text-muted-foreground">Helps us verify your established presence</p>
      </div>

      {/* Additional Notes */}
      <div className="space-y-2">
        <Label htmlFor="additional-notes">Anything else you&apos;d like us to know (optional)</Label>
        <Textarea
          id="additional-notes"
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Awards, certifications, notable appearances, press mentions..."
          className="min-h-[80px] resize-y"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} size="lg" className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <ChefHat className="h-4 w-4" />
            Apply for Verification
          </>
        )}
      </Button>
    </form>
  )
}
