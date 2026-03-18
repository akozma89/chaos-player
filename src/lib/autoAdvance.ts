/**
 * Democratic auto-advance logic
 * On track end: picks highest net-vote pending item and promotes it
 */

import { supabase } from './supabase'
import type { QueueItem } from '../types'

/** Pick next track: highest net votes from pending items, FIFO tiebreaker */
export function pickNextTrack(queue: QueueItem[]): QueueItem | null {
  const pending = queue.filter((i) => i.status === 'pending')
  if (pending.length === 0) return null

  return pending.reduce((best, item) => {
    const netBest = best.upvotes - best.downvotes
    const netItem = item.upvotes - item.downvotes
    if (netItem > netBest) return item
    if (netItem === netBest) {
      return new Date(item.addedAt).getTime() < new Date(best.addedAt).getTime() ? item : best
    }
    return best
  })
}

interface AdvanceQueueParams {
  currentItemId: string
  queue: QueueItem[]
  roomId: string
}

interface AdvanceQueueResult {
  nextItem: QueueItem | null
  error: Error | null
}

export async function advanceQueue({
  currentItemId,
  queue,
  roomId: _roomId,
}: AdvanceQueueParams): Promise<AdvanceQueueResult> {
  // Mark current as completed
  const { error: completeError } = await supabase
    .from('queue_items')
    .update({ status: 'completed' })
    .eq('id', currentItemId)

  if (completeError) {
    return { nextItem: null, error: new Error(completeError.message) }
  }

  const nextItem = pickNextTrack(queue)
  if (!nextItem) return { nextItem: null, error: null }

  // Mark next as playing
  const { error: playError } = await supabase
    .from('queue_items')
    .update({ status: 'playing' })
    .eq('id', nextItem.id)

  if (playError) {
    return { nextItem: null, error: new Error(playError.message) }
  }

  return { nextItem, error: null }
}
