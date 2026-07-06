import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'HapiEats TV Terms of Service — the rules and guidelines governing your use of our platform.',
}

export default function TermsPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Effective date: June 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using HapiEats TV ("Platform", "we", "our"), you agree to be bound by these Terms of Service and all applicable laws. If you do not agree, you may not use the Platform. These Terms constitute a legally binding agreement between you and HapiEats TV.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Eligibility</h2>
            <p>You must be at least 13 years of age to use HapiEats TV. If you are under 18, you represent that a parent or legal guardian has reviewed and agreed to these Terms on your behalf. By using the Platform you represent that you have the legal capacity to enter this agreement.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Accounts and Registration</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate, current, and complete information during registration. You may not share your account or create accounts for others without permission. HapiEats TV reserves the right to suspend or terminate accounts at its discretion.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Content Policy</h2>
            <p>You may not upload, post, or transmit content that:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Is illegal under applicable law</li>
              <li>Contains nudity, sexual content, or graphic violence</li>
              <li>Constitutes hate speech, harassment, or targeted abuse</li>
              <li>Infringes on copyrights, trademarks, or other intellectual property rights</li>
              <li>Is deceptive, misleading, or constitutes spam</li>
              <li>Promotes dangerous activities or substances</li>
              <li>Contains malware, viruses, or other harmful code</li>
              <li>Impersonates any person or entity</li>
            </ul>
            <p className="mt-2">Food-related content must be genuine and not misleadingly edited. HapiEats TV reserves the right to remove any content and suspend accounts that violate this policy, without notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Creator Monetization</h2>
            <p>Creators who monetize content agree to the following:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>HapiEats TV retains a <strong>20% platform fee</strong> on all subscription revenue and pay-per-view purchases.</li>
              <li>Creators receive <strong>80%</strong> of subscription and PPV revenue, paid via Stripe Connect.</li>
              <li>Token gifts: creators receive <strong>70%</strong> of the token face value of gifts received; HapiEats TV retains 30%.</li>
              <li>Creators are responsible for accurately pricing their content and delivering the promised value to subscribers.</li>
              <li>Creators are solely responsible for their tax obligations. HapiEats TV does not withhold taxes on creator earnings.</li>
              <li>Creators must comply with Stripe's Terms of Service to receive payouts.</li>
              <li>HapiEats TV may suspend monetization for accounts that violate content policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Tokens and Virtual Currency</h2>
            <p>HapiEats Tokens are virtual items with no monetary value outside the Platform. Tokens may be used to send gifts to creators during live streams. Tokens are non-refundable, non-transferable, and have no cash value. Unused tokens may be forfeited if your account is terminated for policy violations. HapiEats TV reserves the right to modify token pricing and the gift catalog at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Subscriptions and Payments</h2>
            <p>Platform and creator subscriptions are billed monthly and will automatically renew until cancelled. You may cancel a subscription at any time; cancellation takes effect at the end of the current billing period. Refunds are issued at HapiEats TV's discretion and only for technical failures where content could not be delivered. All payments are processed securely by Stripe.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Intellectual Property</h2>
            <p>You retain all ownership rights to content you upload. By uploading content to HapiEats TV, you grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, stream, and distribute your content on the Platform and in promotional materials. You confirm that you hold all necessary rights to the content you upload, including rights to any music, trademarks, or third-party material included.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. DMCA / Copyright</h2>
            <p>HapiEats TV respects intellectual property rights and complies with the Digital Millennium Copyright Act (DMCA). If you believe your copyrighted work has been infringed, send a notice to <a href="mailto:dmca@hapieatstv.com" className="text-primary hover:underline">dmca@hapieatstv.com</a> including: identification of the copyrighted work, the infringing material and its location, your contact information, a statement of good faith belief, and your signature. Repeat infringers will have their accounts terminated.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Privacy</h2>
            <p>Your use of HapiEats TV is also governed by our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Limitation of Liability</h2>
            <p>HapiEats TV is provided "as is" without warranties of any kind, either express or implied. To the maximum extent permitted by law, HapiEats TV and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use of the Platform. Our total liability to you for any claims shall not exceed the greater of $100 or the amount you paid to HapiEats TV in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Indemnification</h2>
            <p>You agree to indemnify and hold harmless HapiEats TV and its affiliates from any claims, damages, losses, liabilities, costs, and expenses (including attorneys' fees) arising from: your violation of these Terms; your content; your use of the Platform; or your violation of any third party's rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Termination</h2>
            <p>We may suspend or terminate your account at any time for violations of these Terms, with or without notice. You may delete your account at any time via Account Settings. Upon termination, your access to the Platform ceases immediately. Provisions that by their nature should survive termination (including IP rights, disclaimers, and limitations of liability) will survive.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">14. Governing Law & Dispute Resolution</h2>
            <p>These Terms are governed by the laws of the State of [Your State], without regard to its conflict of law provisions. Any disputes shall be resolved by binding arbitration under the AAA Consumer Arbitration Rules, except that either party may seek injunctive relief in a court of competent jurisdiction. You waive any right to a jury trial or class action proceeding.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">15. Changes to Terms</h2>
            <p>We may update these Terms at any time. We will notify you of material changes via email or a prominent notice on the Platform. Your continued use after notice constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">16. Contact</h2>
            <p>Questions about these Terms? Contact us at <a href="mailto:legal@hapieatstv.com" className="text-primary hover:underline">legal@hapieatstv.com</a>.</p>
          </section>

        </div>
      </main>
    </AppShell>
  )
}
