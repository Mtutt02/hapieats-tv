import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'HapiEats TV Privacy Policy — how we collect, use, and protect your personal information.',
}

export default function PrivacyPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Effective date: June 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Who We Are</h2>
            <p>HapiEats TV is a food video streaming platform operated by HapiEats TV, Inc. This Privacy Policy describes how we collect, use, and protect your personal information when you use our website, mobile applications, and services (collectively, the "Platform").</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Information We Collect</h2>
            <p><strong className="text-foreground">Information you provide:</strong> When you create an account, you give us your email address, username, display name, and optionally a bio and profile photo. Creators additionally provide payment and tax information through Stripe.</p>
            <p className="mt-2"><strong className="text-foreground">Content you upload:</strong> Videos, comments, live stream metadata, and any other content you submit to the Platform.</p>
            <p className="mt-2"><strong className="text-foreground">Payment information:</strong> We use Stripe to process payments. We do not store your full card number — Stripe processes and stores payment details subject to their own privacy policy.</p>
            <p className="mt-2"><strong className="text-foreground">Usage data:</strong> We automatically collect information such as videos watched, pages visited, time spent, device type, browser type, IP address, and referring URLs. This helps us improve the Platform.</p>
            <p className="mt-2"><strong className="text-foreground">Cookies and similar technologies:</strong> We use session cookies to keep you logged in and remember your preferences. We do not use advertising trackers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide, operate, and improve the Platform</li>
              <li>To authenticate your identity and maintain your account</li>
              <li>To process payments and manage subscriptions</li>
              <li>To send transactional emails (account verification, password resets, purchase receipts)</li>
              <li>To display your content to other users per your privacy settings</li>
              <li>To detect and prevent fraud, abuse, and policy violations</li>
              <li>To comply with legal obligations</li>
              <li>To send platform updates and feature announcements (you can opt out anytime)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Sharing Your Information</h2>
            <p>We do <strong className="text-foreground">not</strong> sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-foreground">Service providers:</strong> Supabase (database & auth), Mux (video delivery), Stripe (payments), and Vercel (hosting). These providers access data only to perform services on our behalf.</li>
              <li><strong className="text-foreground">Other users:</strong> Your public profile, display name, username, and public videos are visible to other users per your privacy settings.</li>
              <li><strong className="text-foreground">Law enforcement:</strong> We may disclose information when required by law, court order, or to protect the safety of users or the public.</li>
              <li><strong className="text-foreground">Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Cookies</h2>
            <p>We use the following types of cookies:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-foreground">Essential cookies:</strong> Required for authentication and basic Platform functions. These cannot be disabled.</li>
              <li><strong className="text-foreground">Preference cookies:</strong> Remember your settings (theme, language).</li>
              <li><strong className="text-foreground">Analytics cookies:</strong> Help us understand how the Platform is used (aggregate, anonymized data only).</li>
            </ul>
            <p className="mt-2">We do not use third-party advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Data Retention</h2>
            <p>We retain your personal data for as long as your account is active or as needed to provide services. If you delete your account, we will anonymize or delete your personal data within 30 days, except where we are required by law to retain it longer (e.g., tax and financial records, which are retained for 7 years).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Security</h2>
            <p>We implement industry-standard technical and organizational measures to protect your data, including TLS encryption in transit, hashed passwords, and role-based access controls. No system is 100% secure; if you suspect a breach, contact us immediately at <a href="mailto:security@hapieatstv.com" className="text-primary hover:underline">security@hapieatstv.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Your Rights</h2>
            <p>Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-foreground">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-foreground">Correction:</strong> Update inaccurate data through your Account Settings.</li>
              <li><strong className="text-foreground">Deletion:</strong> Request deletion of your account and personal data.</li>
              <li><strong className="text-foreground">Portability:</strong> Request a machine-readable export of your data.</li>
              <li><strong className="text-foreground">Opt-out:</strong> Unsubscribe from marketing emails at any time using the unsubscribe link.</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at <a href="mailto:privacy@hapieatstv.com" className="text-primary hover:underline">privacy@hapieatstv.com</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Children's Privacy</h2>
            <p>HapiEats TV is not directed at children under 13. We do not knowingly collect personal data from children under 13. If you believe a child has provided us with personal information, contact us and we will promptly delete it.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. International Transfers</h2>
            <p>HapiEats TV is based in the United States. If you access the Platform from outside the U.S., your data may be transferred to and processed in the U.S., where privacy laws may differ from your country. By using the Platform, you consent to this transfer.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Third-Party Links</h2>
            <p>The Platform may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their policies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or a prominent notice on the Platform. The "Effective date" at the top of this policy reflects the date of the most recent revision.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Contact Us</h2>
            <p>For privacy-related questions, requests, or concerns, contact us at:</p>
            <address className="not-italic mt-2">
              <strong className="text-foreground">HapiEats TV, Inc.</strong><br />
              Email: <a href="mailto:privacy@hapieatstv.com" className="text-primary hover:underline">privacy@hapieatstv.com</a><br />
              DMCA: <a href="mailto:dmca@hapieatstv.com" className="text-primary hover:underline">dmca@hapieatstv.com</a><br />
              Security: <a href="mailto:security@hapieatstv.com" className="text-primary hover:underline">security@hapieatstv.com</a>
            </address>
          </section>

        </div>
      </main>
    </AppShell>
  )
}
