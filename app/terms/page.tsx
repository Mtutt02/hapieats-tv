import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'HapiEats TV Terms & Conditions — accounts, content, Hapi Tokens, credits and loans, subscriptions, creator payouts, and use of our platform.',
}

export default function TermsPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms &amp; Conditions</h1>
        <p className="text-muted-foreground mb-10">Last updated: July 12, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Agreement to These Terms</h2>
            <p>These Terms &amp; Conditions ("Terms") are a binding agreement between you and [HapiEats TV, LLC — update with your registered legal entity and address] ("HapiEats TV", "we", "us", "our"), the operator of the HapiEats TV platform at hapieatstv.com, including video uploads, live streaming, live chat, the TV browser, Hapi Tokens, gifting, subscriptions, cooking classes and courses, and the HapiEats Studio editing tools (collectively, the "Platform"). By creating an account or using the Platform you accept these Terms. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Eligibility and Age Requirements</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must be at least <strong className="text-foreground">13 years old</strong> to create an account or use the Platform.</li>
              <li>If you are under 18 (or the age of majority where you live), you may only use the Platform with the consent of a parent or legal guardian who has reviewed and agreed to these Terms on your behalf.</li>
              <li>You must be at least <strong className="text-foreground">18 years old</strong> to purchase Hapi Tokens, buy a subscription, enroll in paid classes, or register as a creator who receives payouts. Creator payouts additionally require completing Stripe Connect onboarding, including identity verification.</li>
              <li>You may not use the Platform if you have previously been banned, or if doing so would violate any law that applies to you.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Accounts</h2>
            <p>You must provide accurate registration information and keep it current. You are responsible for safeguarding your credentials and for all activity under your account, including token spending, gifts sent in live chat, and content published from your account. Notify us immediately at <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a> if you suspect unauthorized access. One person per account; you may not sell, transfer, or share accounts, or impersonate another person or brand.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Your Content and License to Us</h2>
            <p>"Content" means anything you upload or transmit through the Platform — videos, live streams, live chat messages, recipes, recipe cards, comments, thumbnails, class materials, and profile information. You retain ownership of your Content. By posting Content you grant HapiEats TV a worldwide, non-exclusive, royalty-free, sublicensable license to host, store, transcode, encode, cache, reproduce, stream, display, distribute, create clips and thumbnails from, and promote your Content on and in connection with the Platform (including transcoding and delivery through our video provider, Mux, and display within the TV browser and channel guide). This license ends when you delete the Content or your account, except (a) where Content has been reshared or gifted-on within the Platform, (b) for server backups kept for a limited period, and (c) where retention is required by law.</p>
            <p className="mt-2">You represent that you own or have secured all rights needed for your Content — including music, footage, imagery, recipes reproduced verbatim from protected works, trademarks, and the appearance of any identifiable people — and that your Content does not violate Section 5.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Prohibited Content and Conduct</h2>
            <p>You may not upload, stream, or transmit Content that:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Is illegal, or promotes illegal activity</li>
              <li>Contains nudity, sexually explicit material, or graphic violence</li>
              <li>Constitutes hate speech, harassment, bullying, or targeted abuse (including in live chat)</li>
              <li>Infringes copyright, trademark, or other intellectual property rights (see our <a href="/dmca" className="text-primary hover:underline">DMCA / Copyright Policy</a>)</li>
              <li>Presents unsafe food-handling, consumption challenges, or preparation practices as safe, or makes false or misleading health, nutrition, or allergen claims</li>
              <li>Is deceptive, spam, engagement manipulation, or artificially inflated metrics (including self-gifting schemes designed to launder token value)</li>
              <li>Contains malware or attempts to interfere with the Platform, other users' streams, or our infrastructure</li>
              <li>Discloses another person's private information without consent</li>
            </ul>
            <p className="mt-2">You also may not scrape the Platform, circumvent playback restrictions, resell access, restream others' live streams, or reverse-engineer our services. We use a combination of automated (AI-assisted) and human moderation and may remove Content, restrict features (including chat, gifting, and streaming), or suspend accounts at our discretion, with or without notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Hapi Tokens and Virtual Gifts</h2>
            <p>Hapi Tokens are a limited, revocable, non-transferable license to access features within the Platform — chiefly sending virtual gifts to creators during live streams and videos. <strong className="text-foreground">Hapi Tokens are not money, are not a substitute for money, have no cash value, and are not redeemable by viewers for cash or any monetary value.</strong> Additionally:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Token purchases are final. <strong className="text-foreground">All token purchases are non-refundable except where a refund is required by applicable law</strong> (for example, certain consumer-protection or withdrawal rights in your jurisdiction).</li>
              <li>Tokens cannot be transferred between accounts, sold, exchanged outside the Platform, or inherited.</li>
              <li>Gift prices are set by the gift catalog in our systems; the price recorded by our servers at the moment of sending is authoritative.</li>
              <li>Sent gifts are final once delivered; the corresponding token debit will not be reversed except in cases of verified technical failure or fraud, at our discretion.</li>
              <li>We may change token pricing, gift catalog contents, and gift values at any time; changes do not apply retroactively to completed transactions.</li>
              <li>Unused tokens may be forfeited without compensation if your account is terminated for violating these Terms, or upon lawful discontinuation of the token program with reasonable advance notice where required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6a. Platform Credits, Token Advances, and Loans</h2>
            <p>From time to time HapiEats TV may, in its <strong className="text-foreground">sole and absolute discretion</strong>, offer eligible users or creators "Credits", token advances, or short-term loans (collectively, "Credit") — for example, promotional token credits, advances against expected creator earnings, or a balance that lets you use certain features before paying. Credit is a privilege, not a right, and the following terms apply:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-foreground">No obligation to extend.</strong> We are never obligated to offer, approve, renew, or increase any Credit, and we may decline, reduce, suspend, or revoke Credit at any time, for any reason, with or without notice, subject to applicable law.</li>
              <li><strong className="text-foreground">Repayment obligation.</strong> Credit that is advanced or loaned to you (as opposed to a free promotional grant we expressly designate as non-repayable) is a binding obligation that you must repay in full according to the repayment terms shown at the time it is extended. Promotional Credits carry no cash value and may expire.</li>
              <li><strong className="text-foreground">Offset against earnings and balances.</strong> You authorize HapiEats TV to recover any outstanding Credit, advance, loan, negative balance, overpayment, reversed transaction, or chargeback by <strong className="text-foreground">deducting or offsetting it against your current or future creator earnings, wallet balances, token balances, and any amounts we owe you</strong>, before making any payout. Where earnings are insufficient, the remaining balance remains due and payable.</li>
              <li><strong className="text-foreground">Recall and acceleration.</strong> We may declare all outstanding Credit immediately due and payable if you violate these Terms, engage in fraud or abuse, initiate a chargeback, close your account, or become the subject of insolvency proceedings.</li>
              <li><strong className="text-foreground">Fees and interest.</strong> Unless a specific Credit offer states otherwise, advances and promotional Credits carry no interest. Any interest, fees, or charges that do apply to a particular loan or advance will be disclosed to you at the time you accept it, and you agree to them by accepting the Credit.</li>
              <li><strong className="text-foreground">Not a banking, deposit, or investment product.</strong> Credits, tokens, and wallet balances are not bank deposits, securities, e-money, or investments, are not insured, earn no interest to you, and confer no ownership or equity interest in HapiEats TV. Balances reflect a limited license to use Platform features, not a monetary claim except for legitimately accrued, payable creator earnings.</li>
              <li><strong className="text-foreground">Anti-abuse.</strong> Credit, tokens, and advances may not be used to launder value, cash out through self-gifting or collusive gifting, or convert promotional grants into cash. We may reverse any transaction and revoke any balance obtained through such abuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Subscriptions, Classes, and Billing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Recurring billing:</strong> Platform subscriptions, creator channel subscriptions, and Studio Pro (Section 9) renew automatically each billing period until cancelled. All payments are processed by Stripe; we never see or store your full card details.</li>
              <li><strong className="text-foreground">Cancellation:</strong> You may cancel any subscription at any time from your account settings or the Stripe billing portal. Cancellation takes effect at the end of the current billing period; you keep access until then. We do not provide prorated refunds for partial periods except where required by law.</li>
              <li><strong className="text-foreground">Price changes:</strong> We will give you advance notice of subscription price changes; they apply from your next renewal after notice.</li>
              <li><strong className="text-foreground">Cooking classes and courses:</strong> One-time class or course purchases grant a personal, non-transferable license to view the class materials on the Platform. If a scheduled live class is cancelled by the creator or by us and not rescheduled, you will receive a refund or equivalent credit.</li>
              <li><strong className="text-foreground">Failed payments:</strong> If a renewal payment fails, we may retry it and suspend paid features until payment succeeds.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Creator Earnings, Payouts, and Taxes</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Creators must be 18+ and complete Stripe Connect onboarding (including identity and, where applicable, tax-form collection) before receiving any payout.</li>
              <li>HapiEats TV retains a <strong className="text-foreground">20% platform fee</strong> on subscription and class/course revenue; creators receive 80%. For token gifts, creators receive <strong className="text-foreground">70%</strong> of the gift's recorded value and HapiEats TV retains 30%. Fee schedules may change with advance notice and apply prospectively only.</li>
              <li>Earnings accrue to your creator wallet and are paid out via Stripe Connect on the schedule and above the minimum threshold shown in Creator Studio. Stripe's own terms and payout timing apply.</li>
              <li>We may withhold, offset, or claw back earnings connected to fraud, refunded or disputed payments, self-gifting, chargebacks, or Terms violations, and may suspend monetization while we investigate.</li>
              <li><strong className="text-foreground">Taxes:</strong> Creators are independent contractors, not employees, agents, or partners of HapiEats TV. You are solely responsible for reporting and paying all taxes on your earnings. We (or Stripe) may issue tax documents such as Form 1099 where legally required.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Studio and Studio Pro</h2>
            <p>The Platform includes an AI-assisted video editor ("Studio"). The paid <strong className="text-foreground">Studio Pro</strong> tier unlocks additional features (such as advanced AI editing tools, higher processing limits, and priority rendering) as described on the Studio Pro purchase page. Studio Pro is a recurring subscription governed by Section 7. Feature sets may evolve; if we materially reduce Studio Pro functionality mid-period, you may contact us for a prorated remedy. Content you create with Studio remains your Content under Section 4, and you are responsible for it — including AI-assisted output you choose to publish.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. AI Features Disclaimer</h2>
            <p>The Platform uses artificial intelligence for content moderation, recommendations, and Studio editing assistance. AI systems can make mistakes: moderation may occasionally flag compliant content or miss violating content, and AI-generated edits, captions, titles, or suggestions may be inaccurate or unsuitable. You are responsible for reviewing AI-assisted output before publishing. Moderation decisions may be appealed by contacting <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a>. Recipe, nutrition, and food-safety information on the Platform — whether human- or AI-generated — is provided for general information only and is not professional dietary, allergy, or medical advice; always verify allergen and food-safety information independently.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Intellectual Property and DMCA</h2>
            <p>The Platform itself — including software, design, the TV browser experience, logos, and trademarks — belongs to HapiEats TV and its licensors and may not be copied or used without permission. We respond to copyright infringement notices under the Digital Millennium Copyright Act and terminate repeat infringers. See our <a href="/dmca" className="text-primary hover:underline">DMCA / Copyright Policy</a> for how to submit a notice or counter-notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Termination</h2>
            <p>You may stop using the Platform and delete your account at any time in Settings. We may suspend or terminate your account, remove Content, or restrict features at any time for violation of these Terms, legal risk, fraud, extended inactivity, or discontinuation of the Platform — with notice where practicable and required. On termination: your license to use the Platform ends; unused tokens are handled per Section 6; accrued, legitimate creator earnings above the payout minimum will be paid out unless withheld under Section 8; and Sections 4 (surviving license terms), 6, 8, 13, 14, and 15 survive.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Disclaimers</h2>
            <p>THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant uninterrupted or error-free operation, that live streams will be free of interruption or latency, that any level of creator earnings will be achieved, or that Content (including recipes and cooking techniques) is accurate or safe. You follow recipes, cooking techniques, and food-handling guidance shown on the Platform at your own risk.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">14. Limitation of Liability and Indemnification</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, HAPIEATS TV AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS, DATA, GOODWILL, OR TOKEN VALUE, ARISING FROM YOUR USE OF THE PLATFORM. OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS IS LIMITED TO THE GREATER OF (A) US$100 OR (B) THE AMOUNTS YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you. You agree to indemnify HapiEats TV against claims arising from your Content, your use of the Platform, or your violation of these Terms or third-party rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">15. Governing Law and Disputes</h2>
            <p>These Terms are governed by the laws of [insert governing state/country — update with your registered legal entity's jurisdiction], without regard to conflict-of-law rules. Disputes will be resolved in the courts of, or by binding arbitration seated in, that jurisdiction, as determined by [HapiEats TV, LLC — update with your registered legal entity and address]. Nothing in this section limits any non-waivable consumer rights you hold under the mandatory laws of your country of residence.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">16. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. For material changes we will give notice by email or a prominent notice on the Platform at least 14 days before they take effect (except changes required immediately by law or for security). Continued use of the Platform after the effective date constitutes acceptance. If you do not agree, stop using the Platform and cancel any subscriptions before the changes take effect.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">17. Contact</h2>
            <p>Questions about these Terms? Contact <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a> or write to [HapiEats TV, LLC — update with your registered legal entity and address]. See also our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>, <a href="/cookies" className="text-primary hover:underline">Cookie Policy</a>, and <a href="/dmca" className="text-primary hover:underline">DMCA / Copyright Policy</a>, each incorporated into these Terms by reference.</p>
          </section>

          <p className="italic text-sm">This document is a template and should be reviewed by qualified legal counsel before relying on it.</p>

        </div>
      </main>
    </AppShell>
  )
}
