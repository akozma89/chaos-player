/**
 * Task 1 (RED): Tests for Supabase schema structure and RLS policy validation
 * These tests verify that our domain types match expected DB schema.
 */

import type { Room, Session, QueueItem, Vote, Token } from '../types'

// Schema shape validators - these will fail until schema utilities are implemented
import { validateRoom, validateSession, validateQueueItem, validateVote, validateToken } from '../lib/schema'

describe('Supabase Schema Validation', () => {
  describe('Room schema', () => {
    it('should validate a valid room object', () => {
      const room: Room = {
        id: 'uuid-123',
        name: 'Test Room',
        hostId: 'host-uuid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      }
      expect(validateRoom(room)).toBe(true)
    })

    it('should reject room without required fields', () => {
      const room = { id: 'uuid-123' } as unknown as Room
      expect(validateRoom(room)).toBe(false)
    })

    it('should reject room with invalid isActive type', () => {
      const room = {
        id: 'uuid-123',
        name: 'Test',
        hostId: 'host-uuid',
        createdAt: 'now',
        updatedAt: 'now',
        isActive: 'yes', // should be boolean
      } as unknown as Room
      expect(validateRoom(room)).toBe(false)
    })
  })

  describe('Session schema', () => {
    it('should validate a valid session', () => {
      const session: Session = {
        id: 'session-uuid',
        roomId: 'room-uuid',
        userId: 'user-uuid',
        username: 'DJ Chaos',
        joinedAt: new Date().toISOString(),
        tokens: 10,
        isHost: false,
      }
      expect(validateSession(session)).toBe(true)
    })

    it('should reject session with negative tokens', () => {
      const session = {
        id: 'session-uuid',
        roomId: 'room-uuid',
        userId: 'user-uuid',
        username: 'DJ Chaos',
        joinedAt: new Date().toISOString(),
        tokens: -5,
        isHost: false,
      }
      expect(validateSession(session)).toBe(false)
    })
  })

  describe('QueueItem schema', () => {
    it('should validate a valid queue item', () => {
      const item: QueueItem = {
        id: 'item-uuid',
        roomId: 'room-uuid',
        sourceId: 'yt-video-id',
        source: 'youtube',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        duration: 354,
        addedBy: 'user-uuid',
        addedAt: new Date().toISOString(),
        position: 0,
        upvotes: 5,
        downvotes: 1,
        status: 'pending',
        playingSince: null,
      }
      expect(validateQueueItem(item)).toBe(true)
    })

    it('should reject queue item with invalid status', () => {
      const item = {
        id: 'item-uuid',
        roomId: 'room-uuid',
        sourceId: 'yt-video-id',
        source: 'youtube',
        title: 'Song',
        artist: 'Artist',
        duration: 200,
        addedBy: 'user-uuid',
        addedAt: new Date().toISOString(),
        position: 0,
        upvotes: 0,
        downvotes: 0,
        status: 'deleted', // invalid status
        playingSince: null,
      }
      expect(validateQueueItem(item)).toBe(false)
    })
  })

  describe('Vote schema', () => {
    it('should validate a valid vote', () => {
      const vote: Vote = {
        id: 'vote-uuid',
        queueItemId: 'item-uuid',
        userId: 'user-uuid',
        type: 'upvote',
        timestamp: new Date().toISOString(),
      }
      expect(validateVote(vote)).toBe(true)
    })

    it('should reject vote with invalid type', () => {
      const vote = {
        id: 'vote-uuid',
        queueItemId: 'item-uuid',
        userId: 'user-uuid',
        type: 'neutral', // invalid
        timestamp: new Date().toISOString(),
      }
      expect(validateVote(vote)).toBe(false)
    })
  })

  describe('Token schema', () => {
    it('should validate a valid token record', () => {
      const token: Token = {
        id: 'token-uuid',
        userId: 'user-uuid',
        roomId: 'room-uuid',
        amount: 5,
        action: 'skip',
        timestamp: new Date().toISOString(),
      }
      expect(validateToken(token)).toBe(true)
    })

    it('should reject token with invalid action', () => {
      const token = {
        id: 'token-uuid',
        userId: 'user-uuid',
        roomId: 'room-uuid',
        amount: 5,
        action: 'delete', // invalid
        timestamp: new Date().toISOString(),
      }
      expect(validateToken(token)).toBe(false)
    })
  })
})

describe('RLS Policy Behavior', () => {
  it('should define constants for token costs', () => {
    const { TOKEN_COSTS } = require('../lib/schema')
    expect(TOKEN_COSTS.SKIP).toBeGreaterThan(0)
    expect(TOKEN_COSTS.STOP).toBeGreaterThan(0)
    expect(TOKEN_COSTS.BOOST).toBeGreaterThan(0)
  })

  it('should define initial token airdrop amount', () => {
    const { INITIAL_TOKEN_AIRDROP } = require('../lib/schema')
    expect(INITIAL_TOKEN_AIRDROP).toBeGreaterThan(0)
    expect(typeof INITIAL_TOKEN_AIRDROP).toBe('number')
  })
})
