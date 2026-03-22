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
  addedByName?: string
  thumbnailUrl?: string
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
      added_by_name: params.addedByName,
      thumbnail_url: params.thumbnailUrl,
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
      addedByName: data.added_by_name,
      thumbnailUrl: data.thumbnail_url,
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
  const { error: voteError } = await supabase.rpc('cast_vote', {
    p_queue_item_id: queueItemId,
    p_user_id: userId,
    p_room_id: roomId,
    p_type: type,
  })

  if (voteError) return { vote: null, error: new Error(voteError.message) }

  // We no longer return the full vote object because we don't need it from the client
  // the client already has it in its optimistic state.
  return {
    vote: null,
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
    addedByName: row.added_by_name as string,
    thumbnailUrl: row.thumbnail_url as string,
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

export async function toggleSkipVote(queueItemId: string, userId: string, roomId: string): Promise<{ success: boolean; skipped: boolean; error: Error | null }> {
  const { data, error } = await supabase.rpc('toggle_skip_vote', {
    p_queue_item_id: queueItemId,
    p_user_id: userId,
    p_room_id: roomId
  });
  if (error) return { success: false, skipped: false, error: new Error(error.message) };
  return { success: data.success, skipped: data.skipped, error: null };
}

export async function getSkipVotes(queueItemId: string): Promise<{ data: string[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('skip_votes')
    .select('user_id')
    .eq('queue_item_id', queueItemId)
  if (error) return { data: [], error: new Error(error.message) }
  return { data: data.map(v => v.user_id), error: null }
}

export async function toggleRoomPause(roomId: string, pause: boolean): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('toggle_room_pause', {
    p_room_id: roomId,
    p_pause: pause,
  })
  return { error: error ? new Error(error.message) : null }
}
