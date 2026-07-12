'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Metadata export via a separate server-side approach isn't possible in
//    'use client' components. We use a static title via Next's not-found
//    or set it in a layout file. For now the page title is set below.
//    The parent layout's template ("%s | HapiEats TV") handles the suffix.

// ── Data ──────────────────────────────────────────────────────────────────────
interface FAQItem {
  q: string
  a: React.ReactNode
}

interface FAQSection {
  id: string
  title: string
  items: FAQItem[]
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        q: 'What is HapiEats TV?',
        a: (
          <>
            HapiEats TV is a video platform built for food lovers and food creators. You can
            watch recipe videos, attend live cooking sessions, enroll in paid{' '}
            <Link href="/classes" className="text-primary hover:underline">
              cooking classes
            </Link>
            , and support your favorite chefs through subscriptions, gifts, and tips. Whether
            you&rsquo;re a home cook, a professional chef, or someone who just loves watching
            food content, HapiEats TV has something for you.
          </>
        ),
      },
      {
        q: 'Is HapiEats TV free to use?',
        a: (
          <>
            Yes — creating an account and watching free content is always free. Some creators
            offer premium content behind a subscription, and certain{' '}
            <Link href="/classes" className="text-primary hover:underline">
              cooking classes
            </Link>{' '}
            require a one-time purchase. You can browse and watch a large library of content
            without ever spending a cent.
          </>
        ),
      },
      {
        q: 'How do I create an account?',
        a: (
          <>
            Click{' '}
            <Link href="/register" className="text-primary hover:underline">
              Sign Up
            </Link>{' '}
            in the top-right corner. You can register with an email address and password. Once
            registered, set up your profile and start exploring content right away. If you want
            to upload videos or earn money, you can upgrade to a creator account from your
            Dashboard at any time.
          </>
        ),
      },
      {
        q: 'What makes HapiEats TV different from YouTube?',
        a: (
          <>
            HapiEats TV is purpose-built for food content. Every feature — from{' '}
            <Link href="/stations" className="text-primary hover:underline">
              Stations
            </Link>{' '}
            (curated cuisine channels) to{' '}
            <Link href="/classes" className="text-primary hover:underline">
              Cooking Classes
            </Link>{' '}
            to live streaming with virtual gifts — is designed around the food creator community.
            Creators keep a much larger share of their earnings, and the discovery algorithm
            focuses on food content rather than competing with every other category on the
            internet.
          </>
        ),
      },
    ],
  },
  {
    id: 'watching',
    title: 'Watching & Discovering Content',
    items: [
      {
        q: 'How do I find recipes by cuisine or dietary preference?',
        a: (
          <>
            Use the{' '}
            <Link href="/search" className="text-primary hover:underline">
              Search
            </Link>{' '}
            bar at the top of any page, or browse{' '}
            <Link href="/stations" className="text-primary hover:underline">
              Stations
            </Link>{' '}
            to find content organized by cuisine type (Italian, Thai, Mexican, etc.) or dietary
            preference (vegan, gluten-free, keto, etc.). You can also filter content by tags on
            any video page.
          </>
        ),
      },
      {
        q: 'What are Stations?',
        a: (
          <>
            <Link href="/stations" className="text-primary hover:underline">
              Stations
            </Link>{' '}
            are curated channels organized around a cuisine or food style — think of them like
            themed TV channels. For example, a &ldquo;Japanese Street Food&rdquo; Station
            collects the best Japanese street food content from multiple creators into one place.
            You can follow Stations to get updates when new content is added.
          </>
        ),
      },
      {
        q: 'What are Classes?',
        a: (
          <>
            <Link href="/classes" className="text-primary hover:underline">
              Classes
            </Link>{' '}
            are structured cooking courses taught by creators on HapiEats TV. They can be
            pre-recorded series, live interactive sessions, or multi-part series. Some classes
            are free; others require a one-time enrollment fee. Once enrolled in a paid class,
            you have lifetime access to all of its lessons.
          </>
        ),
      },
      {
        q: 'Can I save videos to watch later?',
        a: 'Yes — click the bookmark icon on any video or class to save it to your Watch Later list. Access your saved content from your profile at any time.',
      },
    ],
  },
  {
    id: 'flavor-points',
    title: 'Flavor Points',
    items: [
      {
        q: 'What are Flavor Points?',
        a: (
          <>
            Flavor Points are HapiEats TV&rsquo;s virtual currency. You can earn them by
            watching content, engaging with the community, and completing challenges — or
            purchase them directly. Use Flavor Points to send gifts to creators during live
            streams or tip creators on their videos. Visit the{' '}
            <Link href="/flavor" className="text-primary hover:underline">
              Flavor Points page
            </Link>{' '}
            to check your balance and see earning opportunities.
          </>
        ),
      },
      {
        q: 'How do I earn Flavor Points?',
        a: (
          <>
            You earn Flavor Points by:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Watching videos (points credited per minute watched)</li>
              <li>Completing daily check-ins</li>
              <li>Leaving comments and engaging with creators</li>
              <li>Completing featured food challenges</li>
              <li>Referring friends to HapiEats TV</li>
              <li>Purchasing points directly in the{' '}
                <Link href="/flavor" className="text-primary hover:underline">Flavor Shop</Link>
              </li>
            </ul>
          </>
        ),
      },
      {
        q: 'What can I do with Flavor Points?',
        a: 'You can use Flavor Points to send virtual gifts to creators during live streams, tip creators on their videos, and unlock special badges and profile frames. More uses are added regularly.',
      },
      {
        q: 'Do Flavor Points expire?',
        a: 'Flavor Points do not expire as long as your account remains active. If an account is dormant for more than 24 months, points may be subject to expiration. We will notify you by email before any expiration occurs.',
      },
    ],
  },
  {
    id: 'live',
    title: 'Live Streaming & Tokens',
    items: [
      {
        q: 'What are Live Tokens?',
        a: (
          <>
            Live Tokens are the currency used to send gifts during live streams. You can
            purchase token bundles on the{' '}
            <Link href="/tokens" className="text-primary hover:underline">
              Tokens page
            </Link>
            . Tokens are separate from Flavor Points — they are specifically for the live gifting
            economy. Creators receive a share of the token value from every gift they receive.
          </>
        ),
      },
      {
        q: 'How do I send gifts during a live stream?',
        a: (
          <>
            While watching a{' '}
            <Link href="/live" className="text-primary hover:underline">
              live stream
            </Link>
            , open the gift panel on the right side of the player. Choose a gift from the menu
            (each gift has a token cost shown), and tap or click to send. Your gift will appear
            as an animated overlay on the stream and in the chat. You need to have tokens in
            your balance to send gifts.
          </>
        ),
      },
      {
        q: 'How do creators earn from live streams?',
        a: 'Creators earn from the gifts their viewers send during live sessions. HapiEats TV converts the token value of received gifts into real money, which creators can withdraw to their connected bank account. The platform retains a percentage fee — see the Creator section below for details.',
      },
      {
        q: 'What types of gifts can I send?',
        a: 'HapiEats TV offers a range of virtual gifts with food-themed animations — from a simple Taco (1 token) to a grand Chef\'s Kiss (500 tokens). The full gift catalog is shown in the live stream gift panel.',
      },
    ],
  },
  {
    id: 'creators',
    title: 'For Creators',
    items: [
      {
        q: 'How do I become a creator on HapiEats TV?',
        a: (
          <>
            Any registered user can become a creator. After signing in, go to your{' '}
            <Link href="/dashboard" className="text-primary hover:underline">
              Dashboard
            </Link>{' '}
            and click &ldquo;Become a Creator.&rdquo; You&rsquo;ll be prompted to create your
            first channel. Once your channel is set up, you can upload videos, go live, and
            create classes immediately.
          </>
        ),
      },
      {
        q: 'How do creators make money?',
        a: (
          <>
            Creators can earn through multiple streams:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Channel Subscriptions</strong> — viewers pay a monthly fee to access exclusive content on your channel</li>
              <li><strong>Pay-per-view</strong> — charge a one-time fee to unlock specific premium videos</li>
              <li><strong>Paid Classes</strong> — earn from one-time class enrollment fees</li>
              <li><strong>Live Gifts</strong> — receive virtual gifts from fans during live streams, converted to real money</li>
              <li><strong>Tips</strong> — viewers can tip you directly on any video</li>
            </ul>
            Visit your{' '}
            <Link href="/dashboard/monetize" className="text-primary hover:underline">
              Monetize
            </Link>{' '}
            page to set up payouts and connect your Stripe account.
          </>
        ),
      },
      {
        q: 'What is the Verified Chef badge?',
        a: 'The Verified Chef badge ( ) is awarded to creators who have demonstrated professional culinary credentials — such as a culinary school degree, professional kitchen experience, or certified expertise in a specific cuisine. It appears on the creator\'s channel and on any class they teach. Verified Chefs get boosted discovery placement for their classes.',
      },
      {
        q: 'How do I apply for chef verification?',
        a: (
          <>
            Go to your{' '}
            <Link href="/dashboard/settings" className="text-primary hover:underline">
              Creator Settings
            </Link>{' '}
            page and look for the &ldquo;Apply for Chef Verification&rdquo; section. You&rsquo;ll
            need to submit proof of credentials (diploma, license, or letter from a restaurant).
            Our team reviews applications within 5–10 business days.
          </>
        ),
      },
      {
        q: 'How do paid classes work?',
        a: (
          <>
            Create a class from your{' '}
            <Link href="/studio/classes/new" className="text-primary hover:underline">
              Studio
            </Link>
            , set a price, add your lessons, and publish it. When a student enrolls, payment is
            processed via Stripe. After enrollment, the student has lifetime access to all
            lessons in the class. Earnings are credited to your creator balance and can be
            withdrawn at any time. You can also mark individual lessons as free previews so
            prospective students can sample your teaching before buying.
          </>
        ),
      },
      {
        q: 'What is the platform fee for creator earnings?',
        a: (
          <>
            HapiEats TV retains a platform fee on creator earnings to cover payment processing,
            hosting, and platform costs. The current fee structure is:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Subscriptions &amp; pay-per-view: 20% platform fee</li>
              <li>Classes: 15% platform fee</li>
              <li>Live gifts: 30% platform fee (includes token conversion costs)</li>
            </ul>
            Review the full breakdown in the{' '}
            <Link href="/creator-agreement" className="text-primary hover:underline">
              Creator Agreement
            </Link>
            .
          </>
        ),
      },
    ],
  },
  {
    id: 'subscriptions',
    title: 'Subscriptions & Payments',
    items: [
      {
        q: 'How do creator subscriptions work?',
        a: 'Creator subscriptions give you access to a creator\'s exclusive content — videos marked "subscribers only" on their channel. Subscriptions renew monthly and can be canceled at any time. You\'ll continue to have access until the end of the billing period you\'ve already paid for.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'HapiEats TV accepts all major credit and debit cards (Visa, Mastercard, American Express, Discover) as well as digital wallets including Apple Pay and Google Pay, processed securely through Stripe. We do not store your card details — all payment information is handled by Stripe.',
      },
      {
        q: 'How do I cancel a subscription?',
        a: (
          <>
            Go to your{' '}
            <Link href="/settings" className="text-primary hover:underline">
              Account Settings
            </Link>{' '}
            and select &ldquo;Subscriptions.&rdquo; Click &ldquo;Cancel&rdquo; next to any active
            subscription. You&rsquo;ll keep access until the end of your current billing period.
          </>
        ),
      },
      {
        q: 'How do I get a refund?',
        a: (
          <>
            For class enrollments, we offer a 7-day refund if you have not watched more than
            25% of the class content. For channel subscriptions, refunds are considered on a
            case-by-case basis within 48 hours of renewal. Token and Flavor Point purchases are
            non-refundable once tokens have been spent. To request a refund, contact us via the{' '}
            <Link href="/contact" className="text-primary hover:underline">
              Contact page
            </Link>
            .
          </>
        ),
      },
    ],
  },
  {
    id: 'app-credits',
    title: 'App Credits',
    items: [
      {
        q: 'What are App Credits?',
        a: (
          <>
            App Credits are a platform currency that can be used to purchase content on HapiEats TV —
            including pay-per-view videos, Flavor Points, and class enrollments — without needing a
            credit card at checkout. Credits are separate from Flavor Points: Flavor Points are earned
            and spent within the community economy, while App Credits are a monetary balance that covers
            real purchase costs. Visit your{' '}
            <Link href="/studio/credits" className="text-primary hover:underline">
              Credits page
            </Link>{' '}
            to see your balance and transaction history.
          </>
        ),
      },
      {
        q: 'What is the difference between Gift Credits and Loan Credits?',
        a: (
          <>
            <strong className="text-white">Gift Credits</strong> are free credits issued by the HapiEats TV
            team — no repayment is ever required. They are consumed first when you make a purchase.
            <br /><br />
            <strong className="text-white">Loan Credits</strong> are borrowed credits that must be repaid.
            If you are a creator, loan repayment is automatically deducted from your next cashout. If you
            are not a creator, you can repay your loan balance at any time via Stripe from your{' '}
            <Link href="/studio/credits" className="text-primary hover:underline">
              Credits page
            </Link>
            . Gift credits are always consumed before loan credits.
          </>
        ),
      },
      {
        q: 'How do I get App Credits?',
        a: (
          <>
            There are two ways to receive App Credits:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Admin grant</strong> — the HapiEats TV team may issue gift or loan credits
                to your account as part of a promotion, contest prize, or onboarding bonus. You will
                see these appear in your credits transaction history automatically.
              </li>
              <li>
                <strong>Credit request</strong> — you can submit a request for credits directly from
                your{' '}
                <Link href="/studio/credits" className="text-primary hover:underline">
                  Credits page
                </Link>
                . Explain what you would like to use the credits for and our team will review the
                application within 1–2 business days. Requests are capped at $500 per application.
              </li>
            </ul>
          </>
        ),
      },
      {
        q: 'Do creators earn money from credit-funded purchases?',
        a: (
          <>
            No. When a purchase is fully or partially funded by App Credits, the creator receives
            <strong className="text-white"> $0 for the credit-funded portion</strong>. Only the
            portion of a purchase paid with real money (via Stripe) flows through to creator earnings.
            This is explained in the{' '}
            <Link href="/creator-agreement" className="text-primary hover:underline">
              Creator Agreement
            </Link>
            . Gift credits especially should be thought of as a promotional mechanism — they enable
            access to content but do not represent revenue for creators.
          </>
        ),
      },
      {
        q: 'How do Loan Credits get repaid?',
        a: (
          <>
            Loan repayment happens in two ways:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Automatic deduction from creator cashouts</strong> — if you are a creator
                and request a Flavor Points cashout while you have an outstanding loan balance,
                the loan is automatically deducted from your payout before the funds are sent.
                You will see a <em>loanDeducted</em> line on your cashout summary.
              </li>
              <li>
                <strong>Manual Stripe repayment</strong> — if you are not a creator (or want to
                repay sooner), go to your{' '}
                <Link href="/studio/credits" className="text-primary hover:underline">
                  Credits page
                </Link>{' '}
                and click <strong>&ldquo;Repay&rdquo;</strong>. You will be redirected to a Stripe
                checkout to pay the outstanding loan balance.
              </li>
            </ul>
          </>
        ),
      },
      {
        q: 'Do App Credits expire?',
        a: 'Gift credits do not expire unless a specific expiration date was set when the credits were issued (you will be notified if this applies to you). Loan credits do not expire but must be repaid. Any expiration details are visible in your credits transaction history.',
      },
      {
        q: 'Can I transfer or cash out App Credits?',
        a: 'No — App Credits are non-transferable and cannot be cashed out or converted to real money. They can only be used for purchases within HapiEats TV.',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Safety & Community',
    items: [
      {
        q: 'How do I report inappropriate content?',
        a: 'Click the flag (Report) icon on any video, comment, or live stream. Select the reason for your report and add any optional details. Our moderation team reviews all reports, typically within 24–48 hours. For urgent safety concerns, email us directly at safety@hapieatstv.com.',
      },
      {
        q: 'What are the Community Guidelines?',
        a: (
          <>
            Our{' '}
            <Link href="/guidelines" className="text-primary hover:underline">
              Community Guidelines
            </Link>{' '}
            set out what is and isn&rsquo;t allowed on HapiEats TV. In short: keep it
            food-focused, be respectful, don&rsquo;t post misleading or harmful content, and
            respect intellectual property. Violations can result in content removal, account
            suspension, or a permanent ban.
          </>
        ),
      },
      {
        q: 'How do I block or mute someone?',
        a: 'Visit the profile of the user you want to block. Click the three-dot menu (⋯) and select "Block" or "Mute." Blocked users cannot see your content or send you messages. Muted users can still see your content, but their comments will be hidden from your view.',
      },
    ],
  },
]

// ── Accordion Item ─────────────────────────────────────────────────────────────
function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium leading-snug">{item.q}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
          {item.a}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FAQPage() {
  // Track open item as "sectionId:index"
  const [openKey, setOpenKey] = useState<string | null>(null)

  const toggle = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key))
  }

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Frequently Asked Questions</h1>
            <p className="text-muted-foreground mt-1">
              Everything you need to know about HapiEats TV.{' '}
              <Link href="/contact" className="text-primary hover:underline">
                Can&rsquo;t find an answer?
              </Link>
            </p>
          </div>
        </div>

        {/* Ask Hapi Helper — opens the AI assistant */}
        <button
          type="button"
          onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('open-hapi-helper')) }}
          className="mb-10 flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-lg">🍽️</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Ask Hapi Helper</span>
            <span className="block text-xs text-muted-foreground">Chat with our AI assistant for instant answers about how anything works.</span>
          </span>
          <span className="ml-auto text-xs font-semibold text-primary">Open chat →</span>
        </button>

        {/* Sections */}
        <div className="space-y-8">
          {FAQ_SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              {/* Section header */}
              <h2 className="text-base font-semibold text-primary uppercase tracking-wider mb-3 px-1">
                {section.title}
              </h2>

              {/* Accordion */}
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                {section.items.map((item, idx) => {
                  const key = `${section.id}:${idx}`
                  return (
                    <AccordionItem
                      key={key}
                      item={item}
                      isOpen={openKey === key}
                      onToggle={() => toggle(key)}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 border border-border rounded-xl p-6 bg-card text-center">
          <p className="font-semibold mb-1">Still have questions?</p>
          <p className="text-muted-foreground text-sm mb-4">
            Our team is happy to help. Reach out and we&rsquo;ll get back to you within one business day.
          </p>
          <Link
            href="/contact"
            className="inline-block px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
          >
            Contact Support
          </Link>
        </div>
      </main>
    </AppShell>
  )
}
