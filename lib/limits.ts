// ============================================================
// HapiEats — plan limits
// Free accounts are capped on channels; Pro members get more.
// ============================================================

export const FREE_CHANNEL_LIMIT = 2
export const PRO_CHANNEL_LIMIT = 15

export function channelLimit(isPro: boolean): number {
  return isPro ? PRO_CHANNEL_LIMIT : FREE_CHANNEL_LIMIT
}
