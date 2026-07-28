import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'HapiEats TV Privacy Policy — what personal data we collect, why, who we share it with, and the rights you have over it.',
}

export default function PrivacyPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: July 8, 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Who We Are</h2>
            <p>HapiEats TV is a food video platform — on-demand videos, live streams with chat, a TV-style browser, virtual gifting with Hapi Tokens, creator subscriptions, cooking classes, and AI-assisted editing tools — operated by [HapiEats TV, LLC — update with your registered legal entity and address], the data controller for personal data described in this policy. Contact us at <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Data We Collect</h2>
            <p><strong className="text-foreground">Account data:</strong> Email address, username, display name, password (stored only as a secure hash by our authentication provider, Supabase), and account settings.</p>
            <p className="mt-2"><strong className="text-foreground">Profile data:</strong> Optional bio, avatar, cuisine specialties, chef verification details, and any other information you add to your public profile.</p>
            <p className="mt-2"><strong className="text-foreground">Content data:</strong> Videos and live streams you publish, live chat messages, comments, recipe cards, "Tried This" reactions, gifts sent and received, class enrollments, and Studio projects (including AI-assisted edits).</p>
            <p className="mt-2"><strong className="text-foreground">Payment data:</strong> Payments for tokens, subscriptions, Studio Pro, and classes are processed by Stripe. <strong className="text-foreground">Your full card details never touch our servers</strong> — we receive only tokenized identifiers, transaction status, and billing metadata (e.g., last four digits, country). Creators receiving payouts provide identity and tax information directly to Stripe under Stripe Connect.</p>
            <p className="mt-2"><strong className="text-foreground">Usage and analytics data:</strong> Pages visited, videos watched, watch time and playback quality (collected via Mux Data), channel-surfing activity in the TV browser, device and browser type, IP address, and approximate location derived from IP. Vercel Analytics and Speed Insights collect aggregated, privacy-preserving page performance data.</p>
            <p className="mt-2"><strong className="text-foreground">Cookies:</strong> Session and preference cookies as described in our <a href="/cookies" className="text-primary hover:underline">Cookie Policy</a>. We do not use advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Why We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Operating the Platform: hosting your account, streaming video, delivering live chat in real time, and maintaining token balances and gift ledgers</li>
              <li>Processing payments, subscriptions, and creator payouts, and preventing payment fraud</li>
              <li>Content moderation, including automated (AI-assisted) review of uploads, streams, and chat for policy violations, with human review of appeals</li>
              <li>Personalizing recommendations (e.g., cuisine and dietary tag filters, suggested channels)</li>
              <li>Measuring playback quality and site performance to improve the Platform</li>
              <li>Sending transactional messages (receipts, payout notices, security alerts) and, with opt-out available, product updates</li>
              <li>Complying with legal obligations, including tax and financial record-keeping for token purchases and creator earnings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Legal Bases (GDPR)</h2>
            <p>Where the EU/UK GDPR applies, we rely on: <strong className="text-foreground">performance of a contract</strong> (providing the Platform, processing your purchases and payouts); <strong className="text-foreground">legitimate interests</strong> (platform security, fraud prevention, content moderation, service analytics — balanced against your rights); <strong className="text-foreground">consent</strong> (analytics cookies via the consent banner, marketing emails); and <strong className="text-foreground">legal obligation</strong> (tax, accounting, and lawful requests). Where we rely on consent you may withdraw it at any time; where we rely on legitimate interests you may object (see Section 8).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Who We Share Data With</h2>
            <p>We do <strong className="text-foreground">not</strong> sell your personal data. We share it only with:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-foreground">Supabase</strong> — authentication, database, and realtime chat infrastructure</li>
              <li><strong className="text-foreground">Mux</strong> — video encoding, storage, live streaming, and playback analytics (Mux Data)</li>
              <li><strong className="text-foreground">Stripe</strong> — payment processing, subscription billing, and creator payouts (Stripe Connect); Stripe acts as an independent controller for some payment data under its own privacy policy</li>
              <li><strong className="text-foreground">Vercel</strong> — website hosting, Vercel Analytics, and Speed Insights</li>
              <li><strong className="text-foreground">Other users:</strong> your public profile, published videos, live streams, chat messages, and gift animations shown in streams are visible to other users by design</li>
              <li><strong className="text-foreground">Authorities:</strong> where required by law, court order, or to protect users' safety or our legal rights</li>
              <li><strong className="text-foreground">Business transfers:</strong> in a merger, acquisition, or asset sale, subject to this policy's protections</li>
            </ul>
            <p className="mt-2">Each processor accesses only the data needed to perform its service and is bound by a data processing agreement.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. International Transfers</h2>
            <p>Our infrastructure is based in the United States, and the processors listed above may process data in the U.S. and other countries. Where we transfer data of EU/UK/Swiss residents, we rely on appropriate safeguards such as the European Commission's Standard Contractual Clauses and, where applicable, the EU–U.S. Data Privacy Framework certifications of our processors.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Retention</h2>
            <p>We keep personal data while your account is active. When you delete your account, we delete or anonymize your personal data within 30 days, except: financial records of token purchases, gift transactions, and creator payouts (retained up to 7 years for tax and audit obligations); data needed to resolve open disputes or enforce our Terms; moderation records needed to enforce repeat-violation bans; and short-lived encrypted backups. Chat messages in ended live streams are retained as part of stream records unless you delete your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Your Rights</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Access &amp; portability:</strong> Request a copy or machine-readable export of your data by emailing <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a>.</li>
              <li><strong className="text-foreground">Correction:</strong> Update your profile and account data anytime in Settings.</li>
              <li><strong className="text-foreground">Deletion:</strong> Delete your account directly in the app at <strong className="text-foreground">Settings → Account → Delete account</strong>, or email us to request deletion.</li>
              <li><strong className="text-foreground">Objection &amp; restriction:</strong> Object to or ask us to restrict processing based on legitimate interests.</li>
              <li><strong className="text-foreground">Withdraw consent:</strong> Change cookie choices via the consent banner (see the <a href="/cookies" className="text-primary hover:underline">Cookie Policy</a>) and unsubscribe from marketing emails via the link in each email.</li>
              <li><strong className="text-foreground">Complain:</strong> EU/UK residents may lodge a complaint with their supervisory authority.</li>
            </ul>
            <p className="mt-2">We respond to rights requests within 30 days (or the timeline required by your local law) and will verify your identity before acting on them.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. California Privacy Rights (CCPA/CPRA)</h2>
            <p>We <strong className="text-foreground">do not sell your personal information and do not share it for cross-context behavioral advertising</strong>, so no "Do Not Sell or Share My Personal Information" opt-out is needed — there is nothing to opt out of. California residents may exercise rights to know, delete, correct, and port their data as described in Section 8, without discrimination for doing so. Under California's "Shine the Light" law (Civil Code § 1798.83), residents may request information about disclosures of personal information to third parties for their direct marketing purposes; we make no such disclosures. Requests: <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Children (COPPA)</h2>
            <p>The Platform is for users aged 13 and over; children under 13 may not create accounts, and we do not knowingly collect personal information from children under 13. Purchases, gifting, and creator payouts are restricted to users 18+. If you believe a child under 13 has provided us personal data, contact <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a> and we will delete it promptly and terminate the account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Security</h2>
            <p>We protect data with TLS encryption in transit, hashed credentials, row-level security on database tables, role-scoped service access, and least-privilege API design (e.g., stream keys and payment identifiers are never exposed to other users). No system is perfectly secure — report suspected vulnerabilities or breaches to <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Changes to This Policy</h2>
            <p>We may update this policy from time to time; material changes will be announced by email or a prominent notice on the Platform before taking effect. The "Last updated" date above reflects the latest revision.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Contact</h2>
            <p>Privacy questions or requests:</p>
            <address className="not-italic mt-2">
              <strong className="text-foreground">[HapiEats TV, LLC — update with your registered legal entity and address]</strong><br />
              Email: <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a>
            </address>
          </section>

          <p className="italic text-sm">This document is a template and should be reviewed by qualified legal counsel before relying on it.</p>

        </div>
      </main>
    </AppShell>
  )
}
