/**
 * Schema validation utilities and constants for Chaos Music Player
 */

import type { Room, Session, QueueItem, Vote, Token } from '../types'

export const TOKEN_COSTS = {
  SKIP: 5,
  STOP: 10,
  BOOST: 3,
} as const

export const INITIAL_TOKEN_AIRDROP = 10

const VALID_QUEUE_STATUSES = ['pending', 'playing', 'completed', 'skipped'] as const
const VALID_VOTE_TYPES = ['upvote', 'downvote'] as const
const VALID_TOKEN_ACTIONS = ['skip', 'stop', 'boost', 'earn'] as const
const VALID_SOURCES = ['youtube', 'spotify'] as const

export function validateRoom(room: unknown): room is Room {
  if (!room || typeof room !== 'object') return false
  const r = room as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.hostId === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.updatedAt === 'string' &&
    typeof r.isActive === 'boolean'
  )
}

export function validateSession(session: unknown): session is Session {
  if (!session || typeof session !== 'object') return false
  const s = session as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.roomId === 'string' &&
    typeof s.userId === 'string' &&
    typeof s.username === 'string' &&
    typeof s.joinedAt === 'string' &&
    typeof s.tokens === 'number' &&
    s.tokens >= 0 &&
    typeof s.isHost === 'boolean'
  )
}

export function validateQueueItem(item: unknown): item is QueueItem {
  if (!item || typeof item !== 'object') return false
  const q = item as Record<string, unknown>
  return (
    typeof q.id === 'string' &&
    typeof q.roomId === 'string' &&
    typeof q.sourceId === 'string' &&
    VALID_SOURCES.includes(q.source as (typeof VALID_SOURCES)[number]) &&
    typeof q.title === 'string' &&
    typeof q.artist === 'string' &&
    typeof q.duration === 'number' &&
    typeof q.addedBy === 'string' &&
    typeof q.addedAt === 'string' &&
    typeof q.position === 'number' &&
    typeof q.upvotes === 'number' &&
    typeof q.downvotes === 'number' &&
    VALID_QUEUE_STATUSES.includes(q.status as (typeof VALID_QUEUE_STATUSES)[number])
  )
}

export function validateVote(vote: unknown): vote is Vote {
  if (!vote || typeof vote !== 'object') return false
  const v = vote as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.queueItemId === 'string' &&
    typeof v.userId === 'string' &&
    VALID_VOTE_TYPES.includes(v.type as (typeof VALID_VOTE_TYPES)[number]) &&
    typeof v.timestamp === 'string'
  )
}

export function validateToken(token: unknown): token is Token {
  if (!token || typeof token !== 'object') return false
  const t = token as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.userId === 'string' &&
    typeof t.roomId === 'string' &&
    typeof t.amount === 'number' &&
    VALID_TOKEN_ACTIONS.includes(t.action as (typeof VALID_TOKEN_ACTIONS)[number]) &&
    typeof t.timestamp === 'string'
  )
}
