/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'image.mux.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'source.unsplash.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@remotion/bundler', '@remotion/renderer', 'esbuild'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        '@remotion/bundler',
        '@remotion/renderer',
        'esbuild',
      ]
    }
    return config
  },
  async headers() {
    return [{ source: '/api/mux/webhook', headers: [{ key: 'Content-Type', value: 'application/json' }] }]
  },
}

module.exports = nextConfig
