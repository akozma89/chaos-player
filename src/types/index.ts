/**
 * Core domain types for Chaos Music Player
 */

export interface Room {
  id: string
  name: string
  code: string
  hostId: string
  createdAt: string
  updatedAt: string
  isActive: boolean
  isPublic: boolean
  isPaused: boolean
  pausedAt: string | null
  skipVoteCount: number
  allowedResources: 'youtube' | 'spotify' | 'both'
}

export interface Session {
  id: string
  roomId: string
  userId: string
  username: string
  joinedAt: string
  tokens: number
  isHost: boolean
}

export interface QueueItem {
  id: string
  roomId: string
  sourceId: string // e.g., YouTube video ID or Spotify URI
  source: 'youtube' | 'spotify'
  title: string
  artist: string
  duration: number
  thumbnailUrl?: string
  addedBy: string
  addedByName?: string
  addedAt: string
  position: number
  upvotes: number
  downvotes: number
  status: 'pending' | 'playing' | 'completed' | 'skipped'
  playingSince: string | null
}

export interface Vote {
  id: string
  queueItemId: string
  userId: string
  roomId: string
  type: 'upvote' | 'downvote'
  timestamp: string
}

export interface Token {
  id: string
  userId: string
  roomId: string
  amount: number
  action: 'skip' | 'stop' | 'boost' | 'earn'
  timestamp: string
}
