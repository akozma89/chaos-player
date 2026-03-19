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

interface PromoteToPlayingParams {
  queue: QueueItem[]
  roomId: string
}

interface PromoteToPlayingResult {
  promotedItem: QueueItem | null
  error: Error | null
}

/** 
 * Promotes a specific item by ID to 'playing' state.
 * Uses a SECURITY DEFINER RPC to bypass host-only UPDATE RLS.
 */
export async function promoteToPlaying(itemId: string, roomId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('promote_item_by_id', { 
    p_item_id: itemId, 
    p_room_id: roomId 
  })

  if (error) {
    return { error: new Error(error.message) }
  }

  return { error: null }
}

/** 
 * Bootstrap: picks the top pending item and promotes it if nothing is playing.
 */
export async function bootstrapQueue({
  queue,
  roomId,
}: PromoteToPlayingParams): Promise<PromoteToPlayingResult> {
  const candidate = pickNextTrack(queue)
  if (!candidate) return { promotedItem: null, error: null }

  const { error } = await promoteToPlaying(candidate.id, roomId)

  if (error) {
    return { promotedItem: null, error }
  }

  const promotedItem = {
    ...candidate,
    status: 'playing' as const,
    playingSince: new Date().toISOString(),
  }

  return { promotedItem, error: null }
}

export async function advanceQueue({
  currentItemId,
  queue,
  roomId,
}: AdvanceQueueParams): Promise<AdvanceQueueResult> {
  const { error } = await supabase.rpc('advance_queue', {
    p_current_item_id: currentItemId,
    p_room_id: roomId,
  })

  if (error) {
    return { nextItem: null, error: new Error(error.message) }
  }

  const nextItem = pickNextTrack(queue)
  return { nextItem, error: null }
}
