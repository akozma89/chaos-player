/**
 * Leaderboard service - aggregate token scores and vote counts per session
 */

import { supabase } from './supabase'
import type { Session } from '../types'

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  tokensSpent: number
  voteCount: number
  engagementScore: number
}

interface GetLeaderboardResult {
  data: LeaderboardEntry[] | null
  error: Error | null
}

/**
 * Pure function: compute ranked leaderboard from sessions + aggregated data.
 * Hosts are excluded. Sorted by tokensSpent desc, then voteCount desc.
 */
export function computeLeaderboard(
  sessions: Session[],
  tokenSpends: Record<string, number>,
  voteCounts: Record<string, number>
): LeaderboardEntry[] {
  return sessions
    .filter((s) => !s.isHost)
    .map((s) => {
      const tokensSpent = tokenSpends[s.userId] ?? 0
      const voteCount = voteCounts[s.userId] ?? 0
      return {
        rank: 0, // assigned after sort
        userId: s.userId,
        username: s.username,
        tokensSpent,
        voteCount,
        engagementScore: tokensSpent + voteCount,
      }
    })
    .sort((a, b) => {
      if (b.tokensSpent !== a.tokensSpent) return b.tokensSpent - a.tokensSpent
      return b.voteCount - a.voteCount
    })
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }))
}

/**
 * Fetch leaderboard for a room from Supabase.
 */
export async function getLeaderboard(roomId: string): Promise<GetLeaderboardResult> {
  // Fetch active sessions
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('sessions')
    .select()
    .eq('room_id', roomId)

  if (sessionsError || !sessionsData) {
    return { data: null, error: new Error(sessionsError?.message ?? 'Failed to fetch sessions') }
  }

  const sessions: Session[] = sessionsData.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    roomId: row.room_id as string,
    userId: row.user_id as string,
    username: row.username as string,
    joinedAt: row.joined_at as string,
    tokens: row.tokens as number,
    isHost: row.is_host as boolean,
  }))

  // Fetch token spends for room
  const { data: tokensData } = await supabase
    .from('tokens')
    .select()
    .eq('room_id', roomId)

  const tokenSpends: Record<string, number> = {}
  for (const t of tokensData ?? []) {
    const row = t as Record<string, unknown>
    const uid = row.user_id as string
    tokenSpends[uid] = (tokenSpends[uid] ?? 0) + (row.amount as number)
  }

  // Fetch votes for room (via queue_items join not available; use user_id on votes table)
  const { data: votesData } = await supabase
    .from('votes')
    .select()
    .eq('room_id', roomId)

  const voteCounts: Record<string, number> = {}
  for (const v of votesData ?? []) {
    const row = v as Record<string, unknown>
    const uid = row.user_id as string
    voteCounts[uid] = (voteCounts[uid] ?? 0) + 1
  }

  return {
    data: computeLeaderboard(sessions, tokenSpends, voteCounts),
    error: null,
  }
}

/**
 * Subscribe to real-time leaderboard changes for a room.
 * Returns an unsubscribe function.
 */
export function subscribeToLeaderboard(
  roomId: string,
  onUpdate: (roomId: string) => void
): () => void {
  const channel = supabase
    .channel(`leaderboard:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `room_id=eq.${roomId}` }, () => onUpdate(roomId))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens', filter: `room_id=eq.${roomId}` }, () => onUpdate(roomId))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => onUpdate(roomId))

  channel.subscribe()

  return () => supabase.removeChannel(channel)
}
