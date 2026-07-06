import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'
import Logo from '@/components/layout/Logo'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description: 'HapiEats TV — the home of food content creators. Learn about our mission and what we offer.',
}

export default function AboutPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-10">
          <Logo size={48} />
          <div>
            <h1 className="text-3xl font-bold">HapiEats TV</h1>
            <p className="text-muted-foreground">The home of food content creators</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
          <p className="text-foreground text-lg">
            HapiEats TV is a video platform built for food lovers and food creators. Whether you're a home cook, professional chef, street food enthusiast, or baking obsessive — this is your place.
          </p>

          <h2 className="text-xl font-semibold text-foreground">What we offer</h2>
          <p>
            Creators can upload videos, host live cooking sessions, build classes and series, and monetize their content through subscriptions and pay-per-view. Viewers get access to a curated feed of the best food content from around the world, organized into themed Stations.
          </p>

          <h2 className="text-xl font-semibold text-foreground">Our mission</h2>
          <p>
            We believe food is culture. Our mission is to give every food creator the tools they need to build an audience and earn a living doing what they love — while giving food fans the best possible viewing experience.
          </p>

          <h2 className="text-xl font-semibold text-foreground">Get started</h2>
          <p>
            Ready to share your food story? <Link href="/register" className="text-primary hover:underline">Create a free account</Link> and set up your channel in minutes.
          </p>
        </div>

        <div className="mt-10 flex gap-4">
          <Link href="/register" className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition">
            Start creating
          </Link>
          <Link href="/contact" className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition">
            Contact us
          </Link>
        </div>
      </main>
    </AppShell>
  )
}
