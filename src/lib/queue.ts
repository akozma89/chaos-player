/**
 * Queue service - manage music queue, voting, and skip mechanics
 */

import { supabase } from './supabase'
import { TOKEN_COSTS } from './schema'
import type { QueueItem, Vote } from '../types'

// Compute optimistic vote count deltas given new vote and prior vote for same item
export function computeVoteDelta(
  newVote: 'upvote' | 'downvote' | null,
  prevVote: 'upvote' | 'downvote' | undefined
): { upvoteDelta: number; downvoteDelta: number } {
  if (!prevVote) {
    if (newVote === null) return { upvoteDelta: 0, downvoteDelta: 0 }
    return {
      upvoteDelta: newVote === 'upvote' ? 1 : 0,
      downvoteDelta: newVote === 'downvote' ? 1 : 0,
    }
  }
  
  if (newVote === null) {
    return {
      upvoteDelta: prevVote === 'upvote' ? -1 : 0,
      downvoteDelta: prevVote === 'downvote' ? -1 : 0,
    }
  }

  if (prevVote === newVote) {
    return { upvoteDelta: 0, downvoteDelta: 0 }
  }
  // Vote flip
  return {
    upvoteDelta: newVote === 'upvote' ? 1 : -1,
    downvoteDelta: newVote === 'downvote' ? 1 : -1,
  }
}

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
      playingSince: data.playing_since ?? null,
    },
    error: null,
  }
}

interface CastVoteParams {
  queueItemId: string
  userId: string
  roomId: string
  type: 'upvote' | 'downvote' | null
}

interface CastVoteResult {
  vote: Vote | null
  error: Error | null
}

export async function castVote({ queueItemId, userId, roomId, type }: CastVoteParams): Promise<CastVoteResult> {
  if (type === null) {
    const { error: deleteError } = await supabase
      .from('votes')
      .delete()
      .match({ queue_item_id: queueItemId, user_id: userId })

    if (deleteError) return { vote: null, error: new Error(deleteError.message) }
    
    // Recompute vote counts via SECURITY DEFINER RPC
    await supabase.rpc('update_vote_counts', { p_queue_item_id: queueItemId })
    
    return { vote: null, error: null }
  }

  // Upsert vote (one vote per user per item - update if changed)
  const { data: voteData, error: voteError } = await supabase
    .from('votes')
    .upsert(
      { queue_item_id: queueItemId, user_id: userId, room_id: roomId, type, timestamp: new Date().toISOString() },
      { onConflict: 'queue_item_id,user_id' }
    )
    .select()
    .single()

  if (voteError) return { vote: null, error: new Error(voteError.message) }

  // Recompute vote counts via SECURITY DEFINER RPC (bypasses host-only UPDATE policy)
  await supabase.rpc('update_vote_counts', { p_queue_item_id: queueItemId })

  return {
    vote: {
      id: voteData.id,
      queueItemId: voteData.queue_item_id,
      roomId: voteData.room_id,
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
    playingSince: (row.playing_since as string) ?? null,
  }))

  return { data: items, error: null }
}

interface GetVotesResult {
  data: Record<string, 'upvote' | 'downvote'>
  error: Error | null
}

export async function getUserVotes(roomId: string, userId: string): Promise<GetVotesResult> {
  const { data, error } = await supabase
    .from('votes')
    .select('queue_item_id, type')
    .eq('user_id', userId)
    .eq('room_id', roomId)

  if (error) return { data: {}, error: new Error(error.message) }

  const votesMap: Record<string, 'upvote' | 'downvote'> = {}
  ;(data as any[]).forEach((v) => {
    votesMap[v.queue_item_id] = v.type as 'upvote' | 'downvote'
  })

  return { data: votesMap, error: null }
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
