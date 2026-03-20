/**
 * Token Earn Loop - crowd pleaser mechanic
 * Award tokens to a track submitter when their track reaches net vote thresholds.
 * Idempotent: each tier only awards once per queue item.
 */

import { supabase } from './supabase'

export const CROWD_PLEASER_THRESHOLD = 3
export const CROWD_PLEASER_REWARD = 3

export const REWARD_TIERS = [
  { threshold: 15, amount: 15, name: 'Chaos Legend', tier: 3 },
  { threshold: 7, amount: 7, name: 'Vibe Architect', tier: 2 },
  { threshold: 3, amount: 3, name: 'Crowd Pleaser', tier: 1 },
]

export interface CrowdPleaseResult {
  awarded: boolean
  alreadyAwarded?: boolean
  tokensAwarded: number
  userId?: string
  error?: Error
}

interface CheckParams {
  queueItemId: string
  roomId: string
}

/**
 * Check if a queue item qualifies for tiered rewards and award the highest qualifying unearned tier.
 */
export async function checkAndAwardCrowdPleaser({
  queueItemId,
  roomId,
}: CheckParams): Promise<CrowdPleaseResult> {
  // 1. Fetch the queue item
  const { data: queueItem, error: queueError } = await supabase
    .from('queue_items')
    .select()
    .eq('id', queueItemId)
    .single()

  if (queueError || !queueItem) {
    return { awarded: false, tokensAwarded: 0, error: new Error(queueError?.message ?? 'Queue item not found') }
  }

  // 2. Determine qualifying tiers based on net votes
  const netVotes = (queueItem.upvotes as number) - (queueItem.downvotes as number)
  const qualifyingTier = REWARD_TIERS.find(t => netVotes >= t.threshold)

  if (!qualifyingTier) {
    return { awarded: false, tokensAwarded: 0 }
  }

  const userId = queueItem.added_by as string

  // 3. Idempotency check: has THIS tier already been earned for this item?
  // We use metadata to store the tier level
  const { data: existingEarns } = await supabase
    .from('tokens')
    .select()
    .eq('queue_item_id', queueItemId)
    .eq('action', 'earn')

  // Check if any existing earn matches the tier name or level in metadata
  const alreadyEarnedThisTier = existingEarns?.some(e => {
      try {
          const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata
          return meta?.tier === qualifyingTier.tier
      } catch {
          // Fallback for legacy items without metadata: assume tier 1 if amount is 3
          return qualifyingTier.tier === 1 && e.amount === 3
      }
  })

  if (alreadyEarnedThisTier) {
    return { awarded: false, alreadyAwarded: true, tokensAwarded: 0, userId }
  }

  // 4. Fetch current session balance
  const { data: session } = await supabase
    .from('sessions')
    .select()
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .single()

  const currentTokens = (session?.tokens as number) ?? 0

  // 5. Credit tokens to session
  await supabase
    .from('sessions')
    .update({ tokens: currentTokens + qualifyingTier.amount })
    .eq('id', session?.id)

  // 6. Record earn in token ledger
  await supabase.from('tokens').insert({
    user_id: userId,
    room_id: roomId,
    amount: qualifyingTier.amount,
    action: 'earn',
    queue_item_id: queueItemId,
    metadata: JSON.stringify({ tier: qualifyingTier.tier, tierName: qualifyingTier.name }),
    timestamp: new Date().toISOString(),
  })

  return { awarded: true, tokensAwarded: qualifyingTier.amount, userId }
}
