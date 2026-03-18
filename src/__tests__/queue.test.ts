/**
 * Task 5 (RED): Tests for real-time queue sync and voting
 */

import { addToQueue, castVote, computeQueueOrder, skipTrack } from '../lib/queue'
import type { QueueItem } from '../types'

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn() })) })),
      select: jest.fn(() => ({ eq: jest.fn(() => ({ order: jest.fn() })) })),
      update: jest.fn(() => ({ eq: jest.fn() })),
      upsert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn() })) })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
  },
}))

describe('computeQueueOrder', () => {
  it('should sort items by net votes descending', () => {
    const items: QueueItem[] = [
      { id: '1', roomId: 'r', videoId: 'v1', title: 'A', artist: 'X', duration: 200, addedBy: 'u', addedAt: '', position: 2, upvotes: 1, downvotes: 3, status: 'pending' },
      { id: '2', roomId: 'r', videoId: 'v2', title: 'B', artist: 'X', duration: 200, addedBy: 'u', addedAt: '', position: 0, upvotes: 5, downvotes: 1, status: 'pending' },
      { id: '3', roomId: 'r', videoId: 'v3', title: 'C', artist: 'X', duration: 200, addedBy: 'u', addedAt: '', position: 1, upvotes: 3, downvotes: 1, status: 'pending' },
    ]

    const sorted = computeQueueOrder(items)

    // Net votes: A=-2, B=4, C=2 => B, C, A
    expect(sorted[0].id).toBe('2') // B: net 4
    expect(sorted[1].id).toBe('3') // C: net 2
    expect(sorted[2].id).toBe('1') // A: net -2
  })

  it('should only include pending items in order', () => {
    const items: QueueItem[] = [
      { id: '1', roomId: 'r', videoId: 'v1', title: 'A', artist: 'X', duration: 200, addedBy: 'u', addedAt: '', position: 0, upvotes: 5, downvotes: 0, status: 'completed' },
      { id: '2', roomId: 'r', videoId: 'v2', title: 'B', artist: 'X', duration: 200, addedBy: 'u', addedAt: '', position: 1, upvotes: 3, downvotes: 0, status: 'pending' },
    ]

    const sorted = computeQueueOrder(items)

    expect(sorted.length).toBe(1)
    expect(sorted[0].id).toBe('2')
  })

  it('should break ties by addedAt timestamp (FIFO)', () => {
    const items: QueueItem[] = [
      { id: '1', roomId: 'r', videoId: 'v1', title: 'A', artist: 'X', duration: 200, addedBy: 'u', addedAt: '2026-01-01T00:00:01Z', position: 0, upvotes: 3, downvotes: 1, status: 'pending' },
      { id: '2', roomId: 'r', videoId: 'v2', title: 'B', artist: 'X', duration: 200, addedBy: 'u', addedAt: '2026-01-01T00:00:00Z', position: 1, upvotes: 3, downvotes: 1, status: 'pending' },
    ]

    const sorted = computeQueueOrder(items)

    // Same net votes, B added first => B before A
    expect(sorted[0].id).toBe('2')
    expect(sorted[1].id).toBe('1')
  })
})

describe('castVote', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should upsert vote and update item vote counts', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation((table: string) => {
      if (table === 'votes') {
        return {
          upsert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: { id: 'vote-uuid', queue_item_id: 'item-uuid', user_id: 'user-uuid', type: 'upvote', timestamp: '' },
                error: null,
              })),
            })),
          })),
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [{ type: 'upvote' }, { type: 'upvote' }, { type: 'downvote' }],
              error: null,
            })),
          })),
        }
      }
      if (table === 'queue_items') {
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ data: null, error: null })),
          })),
        }
      }
      return {}
    })

    const result = await castVote({
      queueItemId: 'item-uuid',
      userId: 'user-uuid',
      type: 'upvote',
    })

    expect(result.error).toBeNull()
    expect(result.vote).toBeDefined()
  })

  it('should return error when vote fails', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockReturnValue({
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: new Error('RLS violation'),
          })),
        })),
      })),
    })

    const result = await castVote({
      queueItemId: 'item-uuid',
      userId: 'user-uuid',
      type: 'upvote',
    })

    expect(result.error).toBeTruthy()
  })
})

describe('addToQueue', () => {
  it('should add a YouTube video to the queue', async () => {
    const { supabase } = require('../lib/supabase')

    const mockItem = {
      id: 'item-uuid',
      room_id: 'room-uuid',
      video_id: 'yt-id',
      title: 'Test Song',
      artist: 'Test Artist',
      duration: 300,
      added_by: 'user-uuid',
      added_at: new Date().toISOString(),
      position: 0,
      upvotes: 0,
      downvotes: 0,
      status: 'pending',
    }

    supabase.from.mockReturnValue({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: mockItem, error: null })),
        })),
      })),
    })

    const result = await addToQueue({
      roomId: 'room-uuid',
      videoId: 'yt-id',
      title: 'Test Song',
      artist: 'Test Artist',
      duration: 300,
      addedBy: 'user-uuid',
    })

    expect(result.data).toBeDefined()
    expect(result.data?.videoId).toBe('yt-id')
    expect(result.error).toBeNull()
  })
})

describe('skipTrack', () => {
  it('should spend tokens and mark track as skipped', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: { id: 'session-uuid', tokens: 10 },
                  error: null,
                })),
              })),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ data: null, error: null })),
          })),
        }
      }
      if (table === 'queue_items') {
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ data: null, error: null })),
          })),
        }
      }
      if (table === 'tokens') {
        return {
          insert: jest.fn(() => ({ data: null, error: null })),
        }
      }
      return {}
    })

    const result = await skipTrack({
      queueItemId: 'item-uuid',
      userId: 'user-uuid',
      roomId: 'room-uuid',
    })

    expect(result.error).toBeNull()
    expect(result.tokensSpent).toBeGreaterThan(0)
  })

  it('should fail if user has insufficient tokens', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: { id: 'session-uuid', tokens: 0 }, // no tokens
                  error: null,
                })),
              })),
            })),
          })),
        }
      }
      return {}
    })

    const result = await skipTrack({
      queueItemId: 'item-uuid',
      userId: 'user-uuid',
      roomId: 'room-uuid',
    })

    expect(result.error).toBeTruthy()
    expect(result.error?.message).toContain('tokens')
  })
})
