import AppShell from '@/components/layout/AppShell'

export const metadata = {
  title: 'Creator Monetization Agreement',
  description: 'HapiEats TV creator monetization terms — subscriptions, Flavor Points, pay-per-view, and cashouts.',
}

export default function CreatorAgreementPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Creator Monetization Agreement</h1>
        <p className="text-muted-foreground mb-10">Effective date: July 12, 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <p>This Creator Monetization Agreement ("Agreement") is between HapiEats TV, Inc. ("HapiEats TV," "we," "us") and you ("Creator," "you") and governs your participation in HapiEats TV's monetization features. By enabling any monetization feature on HapiEats TV, you agree to this Agreement.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Eligibility</h2>
            <p>To access monetization features you must:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Be at least 18 years old</li>
              <li>Have a valid, verified account in good standing</li>
              <li>Comply with all <a href="/guidelines" className="text-primary hover:underline">Community Guidelines</a> and <a href="/terms" className="text-primary hover:underline">Terms of Service</a></li>
              <li>Have a completed Stripe Connect account (required for subscription income and cashouts)</li>
              <li>Be located in a country supported by Stripe Connect for payouts</li>
            </ul>
            <p className="mt-2">HapiEats TV reserves the right to suspend or revoke monetization access at any time for violations of this Agreement or platform policies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Monetization Features</h2>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">2a. Channel Subscriptions</h3>
            <p>You may set a monthly subscription price for your channel (minimum $0.99/month). Subscribers pay this amount monthly to access your subscriber-only content. HapiEats TV retains a platform fee of 20% of subscription revenue. You receive 80%, paid out via Stripe Connect, net of Stripe's processing fees (typically 2.9% + $0.30 per transaction).</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">2b. Pay-Per-View Videos</h3>
            <p>You may set a one-time purchase price for individual videos (minimum $0.50). HapiEats TV retains a platform fee of 20%. You receive 80%, paid out via Stripe Connect, net of Stripe's processing fees.</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">2c. Flavor Points Gifts</h3>
            <p>Viewers may send you Flavor Points gifts during live streams or on your videos. Flavor Points are a virtual currency purchased by viewers with real money. When a viewer gifts you Flavor Points:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>50% of the USD value of the gift is credited to your creator earnings balance</li>
              <li>50% is retained by HapiEats TV as a platform fee</li>
            </ul>
            <p className="mt-2"><strong className="text-foreground">Flavor Points have no cash value</strong> — viewers cannot exchange them for money. Only creators can convert creator earnings (from gifts) to real money via cashout. See Section 3.</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">2d. Refund Policy on Flavor Points</h3>
            <p>Flavor Points purchases are generally non-refundable once points have been gifted to a creator. Viewers may request refunds for unspent Flavor Points within 14 days of purchase by contacting <a href="mailto:hello@hapieatstv.com" className="text-primary hover:underline">hello@hapieatstv.com</a>. HapiEats TV handles all viewer-facing refund decisions; refunds do not reduce your creator earnings for gifts already received.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Creator Cashouts</h2>
            <p>You may request a cashout of your Flavor Points creator earnings at any time from your Creator Dashboard. Minimum cashout is $5.00.</p>
            <p className="mt-2">A <strong className="text-foreground">platform cashout fee of 5%</strong> applies to all cashouts. This fee covers payment processing costs. After the 5% fee, funds are transferred to your connected Stripe account, typically within 2–7 business days, depending on your bank.</p>
            <p className="mt-2">Example: $100 creator earnings → $5.00 cashout fee → $95.00 transferred to you.</p>
            <p className="mt-2">HapiEats TV will issue required tax forms (1099-K or equivalent) where required by law. You are responsible for reporting and paying taxes on all income earned through the platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3a. Hapi Token Gifts &amp; HapiEats Pro Pool</h2>
            <p>In addition to Flavor Points, viewers may send <strong className="text-foreground">Hapi Token</strong> gifts. For token gifts, you receive <strong className="text-foreground">70%</strong> of the gift's server-recorded value and HapiEats TV retains 30%. If you list classes in <strong className="text-foreground">HapiEats Pro</strong> (all-access membership), you also earn from a monthly creator pool distributed in proportion to how much your Pro-included content is actually watched and completed. Pool amounts vary month to month, are not guaranteed, and are calculated by our systems, whose records are authoritative.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3b. Recoupment, Chargebacks, Advances &amp; Loans</h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-foreground">Chargebacks &amp; refunds.</strong> If a payment that generated your earnings is later refunded, reversed, or charged back, the corresponding creator share is reversed. You are liable for the reversed amount, and we may deduct it from your balance or future earnings.</li>
              <li><strong className="text-foreground">Offset against earnings.</strong> You authorize HapiEats TV to offset and recover any negative balance, overpayment, reversed transaction, chargeback, promotional credit, token advance, or loan we have extended to you against your current and future earnings, wallet balances, and any amounts we owe you, before any cashout. Where earnings are insufficient, the balance remains due.</li>
              <li><strong className="text-foreground">Advances &amp; loans are discretionary.</strong> Any advance against expected earnings, or any loan or credit line we choose to extend, is offered at our sole discretion, is a repayment obligation on the terms disclosed when offered, and may be recalled and become immediately due upon fraud, abuse, a chargeback, account closure, or breach of this Agreement or the <a href="/terms" className="text-primary hover:underline">Terms</a> (see Terms §6a).</li>
              <li><strong className="text-foreground">Holds &amp; investigations.</strong> We may place holds on earnings or cashouts, and suspend monetization, while we investigate suspected fraud, self-gifting, collusive gifting, chargeback abuse, or policy violations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Tax Obligations</h2>
            <p>You are solely responsible for determining and fulfilling your tax obligations in your jurisdiction. HapiEats TV does not provide tax advice. We will provide documentation required by law (e.g., IRS Form 1099-K for US creators earning over reporting thresholds). By using monetization features you represent that you will comply with all applicable tax laws.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Content Standards for Monetization</h2>
            <p>Monetized content must comply with all <a href="/guidelines" className="text-primary hover:underline">Community Guidelines</a>. Additionally, monetized content must be original work created by you or content you have full rights to monetize. We reserve the right to demonetize or remove content that violates these standards. Demonetization does not affect existing earnings from that content.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Intellectual Property</h2>
            <p>You retain ownership of all content you create and upload to HapiEats TV. By uploading content and enabling monetization, you grant HapiEats TV a non-exclusive, worldwide, royalty-free license to host, distribute, display, and promote your content on the platform and in marketing materials. This license ends if you delete the content or terminate your account, except where content has been shared by others.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Stripe Connect</h2>
            <p>Subscription income and pay-per-view revenue are processed through Stripe Connect. By enabling these features, you agree to <a href="https://stripe.com/connect-account/legal" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe's Connected Account Agreement</a> and <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe's Privacy Policy</a>. HapiEats TV is not responsible for delays or errors caused by Stripe. Stripe may conduct identity verification as required by financial regulations.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Account Termination</h2>
            <p>If your account is terminated for violating platform policies, any pending earnings may be forfeited at HapiEats TV's discretion, particularly if the violation was material (e.g., fraud, CSAM, coordinated abuse). In cases of non-material violations, we will make reasonable efforts to pay out eligible pending earnings before termination takes effect. You may appeal termination decisions by emailing <a href="mailto:trust@hapieatstv.com" className="text-primary hover:underline">trust@hapieatstv.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Modifications to This Agreement</h2>
            <p>HapiEats TV may update this Agreement from time to time. We will notify you by email and by a notice in your creator dashboard at least 14 days before changes take effect. Continued use of monetization features after the effective date constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Governing Law</h2>
            <p>This Agreement is governed by the laws of the State of Delaware, United States, without regard to conflict-of-law principles. Any disputes shall be resolved through binding arbitration in accordance with the American Arbitration Association's rules, except that either party may seek injunctive relief in court for intellectual property violations.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Questions?</h2>
            <p>Contact us at <a href="mailto:creators@hapieatstv.com" className="text-primary hover:underline">creators@hapieatstv.com</a> for creator support, or <a href="mailto:legal@hapieatstv.com" className="text-primary hover:underline">legal@hapieatstv.com</a> for legal inquiries.</p>
          </section>

        </div>
      </main>
    </AppShell>
  )
}
