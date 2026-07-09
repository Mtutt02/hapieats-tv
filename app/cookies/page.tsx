import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Cookie Policy — HapiEats TV',
  description: 'HapiEats TV Cookie Policy — the cookies and similar technologies we use, why we use them, and how to control them.',
}

export default function CookiesPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: July 8, 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. What This Policy Covers</h2>
            <p>This policy explains how [HapiEats TV, LLC — update with your registered legal entity and address] ("HapiEats TV", "we") uses cookies and similar technologies (localStorage, session storage, and SDK-level identifiers) on hapieatstv.com. It supplements our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. A cookie is a small text file stored on your device that lets a website remember you between page loads.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Cookies We Use</h2>
            <p>We use two categories only. We do <strong className="text-foreground">not</strong> use advertising or cross-site tracking cookies.</p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-semibold text-foreground">Category</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Purpose</th>
                    <th className="py-2 pr-4 font-semibold text-foreground">Examples</th>
                    <th className="py-2 font-semibold text-foreground">Can you disable it?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border align-top">
                    <td className="py-3 pr-4 text-foreground font-medium">Strictly necessary</td>
                    <td className="py-3 pr-4">Signing you in and keeping your session active (Supabase auth tokens), securing requests, and remembering your cookie-consent choice itself.</td>
                    <td className="py-3 pr-4">Supabase auth/session cookies; consent-preference cookie</td>
                    <td className="py-3">No — the Platform cannot function without them, so they are always on.</td>
                  </tr>
                  <tr className="align-top">
                    <td className="py-3 pr-4 text-foreground font-medium">Analytics</td>
                    <td className="py-3 pr-4">Understanding aggregate site usage and page performance (Vercel Analytics and Speed Insights) and measuring video playback quality — rebuffering, startup time, watch time (Mux Data playback analytics).</td>
                    <td className="py-3 pr-4">Vercel Analytics / Speed Insights identifiers; Mux Data viewer/session identifiers</td>
                    <td className="py-3">Yes — off by default in regions requiring consent; enable or disable via the consent banner.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4"><strong className="text-foreground">Advertising cookies: none.</strong> We do not serve third-party ads, do not use advertising networks' cookies, and do not sell or share data collected via cookies for advertising.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Your Choices</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Consent banner:</strong> On your first visit (and any time afterwards via the "Cookie settings" link in the footer), you can accept or reject analytics cookies. Rejecting them does not affect strictly necessary cookies or your ability to use the Platform.</li>
              <li><strong className="text-foreground">Browser settings:</strong> Every major browser lets you block or delete cookies (typically under Settings → Privacy). Note that blocking strictly necessary cookies will prevent you from staying signed in.</li>
              <li><strong className="text-foreground">Changing your mind:</strong> Reopen the consent banner at any time to update your choice; your new preference applies immediately and is stored in the consent cookie.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. More Information</h2>
            <p>Details on what personal data these technologies collect, our legal bases, retention, and your rights are in our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. We may update this Cookie Policy as our tooling changes; the "Last updated" date reflects the latest revision. Questions: <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a>.</p>
          </section>

          <p className="italic text-sm">This document is a template and should be reviewed by qualified legal counsel before relying on it.</p>

        </div>
      </main>
    </AppShell>
  )
}
