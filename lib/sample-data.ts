/**
 * Sample content shown on the home page (fallback + always-visible cards).
 * Videos sourced from Pexels (free to use, no attribution required).
 * CDN URL pattern: https://videos.pexels.com/video-files/{id}/{id}-hd_1920_1080_25fps.mp4
 */

// Helper — build Pexels video + thumbnail URLs from a video ID
const pexels = (id: number, thumbSlug?: string) => ({
  videoUrl: `https://videos.pexels.com/video-files/${id}/${id}-hd_1920_1080_25fps.mp4`,
  thumbnailUrl: thumbSlug
    ? `https://images.pexels.com/videos/${id}/${thumbSlug}?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop`
    : `https://images.pexels.com/videos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop`,
})

export interface SampleVideo {
  id: string
  title: string
  thumbnailUrl: string
  /** Direct MP4 URL for hover/hold preview (Pexels CDN) */
  videoUrl?: string
  /** Mux playback ID — only set for content actually in Mux */
  muxPlaybackId?: string | null
  channelName: string
  channelAvatar: string
  viewCount: number
  duration: string
  publishedAt: string
  stationSlug?: string
}

export interface SampleStation {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  coverUrl: string
  videoCount: number
  followerCount: number
  theme: string
}

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: 'sample-1',
    title: 'Perfect Ramen from Scratch — Tonkotsu Broth Secrets',
    ...pexels(1341925, 'free-video-1341925.jpg'),
    channelName: 'Ramen Lab',
    channelAvatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=80&h=80&fit=crop&q=80',
    viewCount: 1240000,
    duration: '18:32',
    publishedAt: '2025-03-12T10:00:00Z',
    stationSlug: 'japanese-kitchen',
  },
  {
    id: 'sample-2',
    title: 'Street Tacos Al Pastor — Mexico City Style',
    ...pexels(854565, 'free-video-854565.jpg'),
    channelName: 'Taquero Mike',
    channelAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&q=80',
    viewCount: 892000,
    duration: '12:45',
    publishedAt: '2025-04-01T14:00:00Z',
    stationSlug: 'street-food',
  },
  {
    id: 'sample-3',
    title: 'Sourdough That Actually Works — Beginner to Pro',
    ...pexels(6603824),
    channelName: 'Flour & Fire',
    channelAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&q=80',
    viewCount: 2100000,
    duration: '24:18',
    publishedAt: '2025-02-20T09:00:00Z',
    stationSlug: 'baking',
  },
  {
    id: 'sample-4',
    title: 'Texas Brisket — 14-Hour Smoke Worth Every Second',
    ...pexels(14150484),
    channelName: 'Smoke Signal BBQ',
    channelAvatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&q=80',
    viewCount: 3400000,
    duration: '31:07',
    publishedAt: '2025-01-15T16:00:00Z',
    stationSlug: 'bbq',
  },
  {
    id: 'sample-5',
    title: 'Homemade Pasta 5 Ways — Shapes, Sauces & Tips',
    ...pexels(3196175, 'free-video-3196175.jpg'),
    channelName: "Nonna's Table",
    channelAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&q=80',
    viewCount: 1780000,
    duration: '22:55',
    publishedAt: '2025-03-05T11:00:00Z',
    stationSlug: 'italian',
  },
  {
    id: 'sample-6',
    title: 'Croissants at Home — The Laminated Dough Method',
    ...pexels(7423915),
    channelName: 'Pastry with Pierre',
    channelAvatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&fit=crop&q=80',
    viewCount: 945000,
    duration: '35:20',
    publishedAt: '2025-04-10T08:00:00Z',
    stationSlug: 'baking',
  },
  {
    id: 'sample-7',
    title: 'One-Pan Thai Basil Chicken — 15-Minute Weeknight Dinner',
    ...pexels(854345, 'free-video-854345.jpg'),
    channelName: 'Bangkok Bites',
    channelAvatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=80&h=80&fit=crop&q=80',
    viewCount: 620000,
    duration: '9:48',
    publishedAt: '2025-05-01T12:00:00Z',
    stationSlug: 'street-food',
  },
  {
    id: 'sample-8',
    title: 'Chocolate Lava Cakes — Restaurant Secret Finally Revealed',
    ...pexels(4661944),
    channelName: 'Sweet Science',
    channelAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&q=80',
    viewCount: 4500000,
    duration: '14:02',
    publishedAt: '2025-02-14T10:00:00Z',
    stationSlug: 'desserts',
  },
  {
    id: 'sample-9',
    title: "Plant-Based Butter Chicken — You Won't Miss the Meat",
    ...pexels(4252800),
    channelName: 'Green Plate',
    channelAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&q=80',
    viewCount: 310000,
    duration: '17:15',
    publishedAt: '2025-04-22T15:00:00Z',
    stationSlug: 'plant-based',
  },
  {
    id: 'sample-10',
    title: 'Sushi Rolls for Beginners — Inside Out & Traditional',
    ...pexels(4253333),
    channelName: 'Sushi With Ken',
    channelAvatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&q=80',
    viewCount: 2700000,
    duration: '28:41',
    publishedAt: '2025-03-28T13:00:00Z',
    stationSlug: 'japanese-kitchen',
  },
  {
    id: 'sample-11',
    title: 'Nashville Hot Chicken — Spice Level Customized',
    ...pexels(854216, 'free-video-854216.jpg'),
    channelName: 'American Heat',
    channelAvatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&fit=crop&q=80',
    viewCount: 1100000,
    duration: '11:30',
    publishedAt: '2025-05-10T17:00:00Z',
    stationSlug: 'street-food',
  },
  {
    id: 'sample-12',
    title: 'French Onion Soup — The Classic Elevated',
    ...pexels(10301752),
    channelName: 'Bistro Skills',
    channelAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&q=80',
    viewCount: 480000,
    duration: '20:05',
    publishedAt: '2025-01-30T11:00:00Z',
    stationSlug: 'italian',
  },
  {
    id: 'sample-13',
    title: 'Peking Duck at Home — Crispy Skin Without a Rotisserie',
    ...pexels(4253717),
    channelName: 'Wok With Wang',
    channelAvatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=80&h=80&fit=crop&q=80',
    viewCount: 1850000,
    duration: '26:14',
    publishedAt: '2025-05-15T10:00:00Z',
    stationSlug: 'street-food',
  },
  {
    id: 'sample-14',
    title: 'Birria Tacos — The Viral Recipe That Started It All',
    ...pexels(2882090, 'free-video-2882090.jpg'),
    channelName: 'Taquero Mike',
    channelAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&q=80',
    viewCount: 5200000,
    duration: '19:22',
    publishedAt: '2025-05-20T14:00:00Z',
    stationSlug: 'street-food',
  },
  {
    id: 'sample-15',
    title: 'Beef Wellington — Gordon Would Be Proud',
    ...pexels(4252801),
    channelName: 'Bistro Skills',
    channelAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&q=80',
    viewCount: 980000,
    duration: '38:05',
    publishedAt: '2025-06-01T09:00:00Z',
    stationSlug: 'italian',
  },
  {
    id: 'sample-16',
    title: 'Mango Sticky Rice — Thai Street Dessert Perfected',
    ...pexels(6603830),
    channelName: 'Bangkok Bites',
    channelAvatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=80&h=80&fit=crop&q=80',
    viewCount: 730000,
    duration: '8:50',
    publishedAt: '2025-06-05T16:00:00Z',
    stationSlug: 'desserts',
  },
]

export const SAMPLE_STATIONS: SampleStation[] = [
  {
    id: 'station-1',
    slug: 'japanese-kitchen',
    name: 'Japanese Kitchen',
    description: 'Ramen, sushi, izakaya classics and modern Japanese cooking',
    icon: '🍣',
    coverUrl: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&h=400&fit=crop&q=80',
    videoCount: 312,
    followerCount: 48200,
    theme: 'Japanese',
  },
  {
    id: 'station-2',
    slug: 'street-food',
    name: 'Street Food World',
    description: 'Street eats from every corner of the planet',
    icon: '🌮',
    coverUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=400&fit=crop&q=80',
    videoCount: 541,
    followerCount: 91000,
    theme: 'Street Food',
  },
  {
    id: 'station-3',
    slug: 'bbq',
    name: 'BBQ & Smoke',
    description: 'Pitmasters, backyard cooks, and the craft of low-and-slow',
    icon: '🔥',
    coverUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&h=400&fit=crop&q=80',
    videoCount: 228,
    followerCount: 62400,
    theme: 'BBQ',
  },
  {
    id: 'station-4',
    slug: 'baking',
    name: 'Baking Lab',
    description: 'Bread, pastries, cakes — the science and art of baking',
    icon: '🥐',
    coverUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&h=400&fit=crop&q=80',
    videoCount: 390,
    followerCount: 77100,
    theme: 'Baking',
  },
  {
    id: 'station-5',
    slug: 'italian',
    name: 'Italian Table',
    description: 'Pasta, pizza, risotto — authentic and modern Italian',
    icon: '🍝',
    coverUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=400&fit=crop&q=80',
    videoCount: 284,
    followerCount: 54800,
    theme: 'Italian',
  },
  {
    id: 'station-6',
    slug: 'plant-based',
    name: 'Plant-Based Kitchen',
    description: 'Vegan and vegetarian recipes that actually excite',
    icon: '🌱',
    coverUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=400&fit=crop&q=80',
    videoCount: 195,
    followerCount: 39200,
    theme: 'Plant-Based',
  },
  {
    id: 'station-7',
    slug: 'desserts',
    name: 'Dessert Lab',
    description: 'Chocolate, ice cream, tarts and everything sweet',
    icon: '🍫',
    coverUrl: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=800&h=400&fit=crop&q=80',
    videoCount: 416,
    followerCount: 83300,
    theme: 'Desserts',
  },
  {
    id: 'station-8',
    slug: 'general',
    name: 'General Station',
    description: "Everything food — upload anything here if you don't fit a theme",
    icon: '🍽️',
    coverUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop&q=80',
    videoCount: 1024,
    followerCount: 120000,
    theme: 'General',
  },
]

export const FOOD_CATEGORIES = [
  'All', 'Street Food', 'Japanese', 'Italian', 'BBQ & Smoke',
  'Baking', 'Plant-Based', 'Desserts', 'Quick & Easy', 'Fine Dining',
  'Home Cooking', 'Techniques',
]
