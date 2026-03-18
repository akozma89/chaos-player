/**
 * Token Earn Loop - crowd pleaser mechanic
 * Award tokens to a track submitter when their track reaches net +3 votes.
 * Idempotent: only awards once per queue item.
 */

import { supabase } from './supabase'

export const CROWD_PLEASER_THRESHOLD = 3
export const CROWD_PLEASER_REWARD = 3

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
 * Check if a queue item qualifies for crowd pleaser reward and award if so.
 * Safe to call on every vote — idempotent via token ledger check.
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

  // 2. Check net votes meet threshold
  const netVotes = (queueItem.upvotes as number) - (queueItem.downvotes as number)
  if (netVotes < CROWD_PLEASER_THRESHOLD) {
    return { awarded: false, tokensAwarded: 0 }
  }

  const userId = queueItem.added_by as string

  // 3. Idempotency check: has this item already earned tokens?
  const { data: existingEarns } = await supabase
    .from('tokens')
    .select()
    .eq('queue_item_id', queueItemId)
    .eq('action', 'earn')

  if (existingEarns && existingEarns.length > 0) {
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
    .update({ tokens: currentTokens + CROWD_PLEASER_REWARD })
    .eq('id', session?.id)

  // 6. Record earn in token ledger
  await supabase.from('tokens').insert({
    user_id: userId,
    room_id: roomId,
    amount: CROWD_PLEASER_REWARD,
    action: 'earn',
    queue_item_id: queueItemId,
    timestamp: new Date().toISOString(),
  })

  return { awarded: true, tokensAwarded: CROWD_PLEASER_REWARD, userId }
}
