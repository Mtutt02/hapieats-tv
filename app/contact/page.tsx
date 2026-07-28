import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the HapiEats TV team for support, partnerships, or press inquiries.',
}

export default function ContactPage() {
  return (
    <AppShell>
      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-muted-foreground mb-10">We'd love to hear from you.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {[
            { label: 'General Inquiries', email: 'hello@hapieatstv.com', desc: 'Partnerships, press, general questions' },
            { label: 'Creator Support', email: 'creators@hapieatstv.com', desc: 'Help with your channel or uploads' },
            { label: 'Privacy & Legal', email: 'privacy@hapieatstv.com', desc: 'Data requests, copyright, legal' },
            { label: 'Report Content', email: 'trust@hapieatstv.com', desc: 'Report harmful or inappropriate content' },
          ].map(({ label, email, desc }) => (
            <div key={email} className="bg-card border border-border rounded-xl p-5">
              <div className="font-medium mb-1">{label}</div>
              <a href={`mailto:${email}`} className="text-primary text-sm hover:underline">{email}</a>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-1">Response Times</h2>
          <p className="text-sm text-muted-foreground">We typically respond within 1–3 business days. For urgent content moderation or account security issues, use <a href="mailto:trust@hapieatstv.com" className="text-primary hover:underline">trust@hapieatstv.com</a> and we'll prioritize your request.</p>
        </div>
      </main>
    </AppShell>
  )
}
