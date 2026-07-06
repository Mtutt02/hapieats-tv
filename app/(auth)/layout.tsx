import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Sign In | HapiEats TV',
    template: '%s | HapiEats TV',
  },
  description: 'Sign in to your HapiEats TV account to watch food videos, support creators, and manage your channel.',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
