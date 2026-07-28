import Mux from '@mux/mux-node'

export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID ?? 'placeholder',
  tokenSecret: process.env.MUX_TOKEN_SECRET ?? 'placeholder',
})

export const { video, data } = mux

/** Generate a signed playback token for private/paywalled videos */
export async function getSignedPlaybackToken(playbackId: string, type: 'video' | 'thumbnail' = 'video') {
  return mux.jwt.signPlaybackId(playbackId, {
    type,
    keyId: process.env.MUX_SIGNING_KEY_ID!,
    keySecret: process.env.MUX_SIGNING_PRIVATE_KEY!,
    expiration: '1h',
  })
}

/** Get the thumbnail URL for a Mux asset */
export function getThumbnailUrl(playbackId: string, time = 0) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve&time=${time}`
}

/** Get the animated GIF preview URL */
export function getGifUrl(playbackId: string) {
  return `https://image.mux.com/${playbackId}/animated.gif?width=320`
}
