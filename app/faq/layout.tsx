import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about HapiEats TV — getting started, Flavor Points, live streaming, paid classes, creator earnings, and more.',
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
