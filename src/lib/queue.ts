/**
 * Queue service - manage music queue, voting, and skip mechanics
 */

import { supabase } from './supabase'
import { TOKEN_COSTS } from './schema'
import type { QueueItem, Vote } from '../types'

// Sort pending items by net votes (upvotes - downvotes), FIFO for ties
export function computeQueueOrder(items: QueueItem[]): QueueItem[] {
  return items
    .filter((item) => item.status === 'pending')
    .sort((a, b) => {
      const netA = a.upvotes - a.downvotes
      const netB = b.upvotes - b.downvotes
      if (netB !== netA) return netB - netA
      // FIFO tiebreaker
      return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
    })
}

interface AddToQueueParams {
  roomId: string
  sourceId: string
  source: 'youtube' | 'spotify'
  title: string
  artist: string
  duration: number
  addedBy: string
}

interface AddToQueueResult {
  data: QueueItem | null
  error: Error | null
}

export async function addToQueue(params: AddToQueueParams): Promise<AddToQueueResult> {
  const { data, error } = await supabase
    .from('queue_items')
    .insert({
      room_id: params.roomId,
      video_id: params.sourceId,
      source: params.source,
      title: params.title,
      artist: params.artist,
      duration: params.duration,
      added_by: params.addedBy,
      position: 0,
      upvotes: 0,
      downvotes: 0,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }

  return {
    data: {
      id: data.id,
      roomId: data.room_id,
      sourceId: data.video_id,
      source: data.source as 'youtube' | 'spotify',
      title: data.title,
      artist: data.artist,
      duration: data.duration,
      addedBy: data.added_by,
      addedAt: data.added_at,
      position: data.position,
      upvotes: data.upvotes,
      downvotes: data.downvotes,
      status: data.status,
    },
    error: null,
  }
}

interface CastVoteParams {
  queueItemId: string
  userId: string
  type: 'upvote' | 'downvote'
}

interface CastVoteResult {
  vote: Vote | null
  error: Error | null
}

export async function castVote({ queueItemId, userId, type }: CastVoteParams): Promise<CastVoteResult> {
  // Upsert vote (one vote per user per item - update if changed)
  const { data: voteData, error: voteError } = await supabase
    .from('votes')
    .upsert(
      { queue_item_id: queueItemId, user_id: userId, type, timestamp: new Date().toISOString() },
      { onConflict: 'queue_item_id,user_id' }
    )
    .select()
    .single()

  if (voteError) return { vote: null, error: new Error(voteError.message) }

  // Recompute vote counts from all votes for this item
  const { data: allVotes, error: countError } = await supabase
    .from('votes')
    .select('type')
    .eq('queue_item_id', queueItemId)

  if (!countError && allVotes) {
    const upvotes = allVotes.filter((v: { type: string }) => v.type === 'upvote').length
    const downvotes = allVotes.filter((v: { type: string }) => v.type === 'downvote').length

    await supabase
      .from('queue_items')
      .update({ upvotes, downvotes })
      .eq('id', queueItemId)
  }

  return {
    vote: {
      id: voteData.id,
      queueItemId: voteData.queue_item_id,
      userId: voteData.user_id,
      type: voteData.type,
      timestamp: voteData.timestamp,
    },
    error: null,
  }
}

interface GetQueueResult {
  data: QueueItem[]
  error: Error | null
}

export async function getQueueItems(roomId: string): Promise<GetQueueResult> {
  const { data, error } = await supabase
    .from('queue_items')
    .select()
    .eq('room_id', roomId)
    .order('position', { ascending: true })

  if (error) return { data: [], error: new Error(error.message) }

  const items: QueueItem[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    roomId: row.room_id as string,
    sourceId: row.video_id as string,
    source: (row.source as 'youtube' | 'spotify') || 'youtube',
    title: row.title as string,
    artist: row.artist as string,
    duration: row.duration as number,
    addedBy: row.added_by as string,
    addedAt: row.added_at as string,
    position: row.position as number,
    upvotes: row.upvotes as number,
    downvotes: row.downvotes as number,
    status: row.status as QueueItem['status'],
  }))

  return { data: items, error: null }
}

interface SkipTrackParams {
  queueItemId: string
  userId: string
  roomId: string
}

interface SkipTrackResult {
  tokensSpent: number
  error: Error | null
}

export async function skipTrack({ queueItemId, userId, roomId }: SkipTrackParams): Promise<SkipTrackResult> {
  // Check user has enough tokens
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .select()
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .single()

  if (sessionError || !sessionData) {
    return { tokensSpent: 0, error: new Error('Session not found') }
  }

  const cost = TOKEN_COSTS.SKIP
  if (sessionData.tokens < cost) {
    return { tokensSpent: 0, error: new Error(`Insufficient tokens: need ${cost}, have ${sessionData.tokens}`) }
  }

  // Deduct tokens
  await supabase
    .from('sessions')
    .update({ tokens: sessionData.tokens - cost })
    .eq('id', sessionData.id)

  // Mark item as skipped
  await supabase
    .from('queue_items')
    .update({ status: 'skipped' })
    .eq('id', queueItemId)

  // Record token spend
  await supabase.from('tokens').insert({
    user_id: userId,
    room_id: roomId,
    amount: cost,
    action: 'skip',
    timestamp: new Date().toISOString(),
  })

  return { tokensSpent: cost, error: null }
}
