/**
 * Core domain types for Chaos Music Player
 */

export interface Room {
  id: string
  name: string
  hostId: string
  createdAt: string
  updatedAt: string
  isActive: boolean
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
  videoId: string
  title: string
  artist: string
  duration: number
  addedBy: string
  addedAt: string
  position: number
  upvotes: number
  downvotes: number
  status: 'pending' | 'playing' | 'completed' | 'skipped'
}

export interface Vote {
  id: string
  queueItemId: string
  userId: string
  type: 'upvote' | 'downvote'
  timestamp: string
}

export interface Token {
  id: string
  userId: string
  roomId: string
  amount: number
  action: 'skip' | 'stop' | 'boost'
  timestamp: string
}
