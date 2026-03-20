/**
 * Task 1 (RED): Integration tests for Supabase Realtime queue sync
 * Tests: add/remove/reorder queue items via Supabase writes
 */

import { addToQueue, castVote, computeQueueOrder } from '../lib/queue'
import type { QueueItem } from '../types'

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  },
}))

const makeItem = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: 'item-1',
  roomId: 'room-1',
  sourceId: 'v1',
  source: 'youtube',
  title: 'Track',
  artist: 'Artist',
  duration: 200,
  addedBy: 'user-1',
  addedAt: '2026-01-01T00:00:00Z',
  position: 0,
  upvotes: 0,
  downvotes: 0,
  status: 'pending',
  playingSince: null,
  ...overrides,
} as QueueItem)

describe('Queue sync: add/remove/reorder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('adds a track to queue via Supabase insert and returns typed QueueItem', async () => {
    const { supabase } = require('../lib/supabase')
    const newItem = {
      id: 'item-new',
      room_id: 'room-1',
      video_id: 'yt-abc',
      source: 'youtube',
      title: 'New Song',
      artist: 'Artist',
      duration: 180,
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      position: 0,
      upvotes: 0,
      downvotes: 0,
      status: 'pending',
    }

    supabase.from.mockReturnValue({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: newItem, error: null })),
        })),
      })),
    })

    const result = await addToQueue({
      roomId: 'room-1',
      sourceId: 'yt-abc',
      source: 'youtube',
      title: 'New Song',
      artist: 'Artist',
      duration: 180,
      addedBy: 'user-1',
    })

    expect(result.error).toBeNull()
    expect(result.data?.sourceId).toBe('yt-abc')
    expect(result.data?.roomId).toBe('room-1')
    expect(result.data?.status).toBe('pending')
  })

  it('reorders queue so highest net-vote item appears first', () => {
    const items: QueueItem[] = [
      makeItem({ id: '1', upvotes: 1, downvotes: 0, addedAt: '2026-01-01T00:00:00Z' }), // net 1
      makeItem({ id: '2', upvotes: 0, downvotes: 0, addedAt: '2026-01-01T00:00:01Z' }), // net 0
      makeItem({ id: '3', upvotes: 3, downvotes: 0, addedAt: '2026-01-01T00:00:02Z' }), // net 3 → top
    ]

    const order = computeQueueOrder(items)
    expect(order[0].id).toBe('3') // net 3
    expect(order[1].id).toBe('1') // net 1
    expect(order[2].id).toBe('2') // net 0
  })

  it('filters completed and skipped items from active queue view', () => {
    const items: QueueItem[] = [
      makeItem({ id: '1', status: 'completed', upvotes: 5 }),
      makeItem({ id: '2', status: 'skipped', upvotes: 3 }),
      makeItem({ id: '3', status: 'pending', upvotes: 0 }),
    ]

    const active = computeQueueOrder(items)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('3')
  })

  it('FIFO tiebreak: earlier addedAt wins when net votes are equal', () => {
    const items: QueueItem[] = [
      makeItem({ id: 'late', upvotes: 2, downvotes: 0, addedAt: '2026-01-01T00:00:05Z' }),
      makeItem({ id: 'early', upvotes: 2, downvotes: 0, addedAt: '2026-01-01T00:00:01Z' }),
    ]

    const order = computeQueueOrder(items)
    expect(order[0].id).toBe('early')
  })

  it('Supabase write failure on addToQueue returns error without throwing', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockReturnValue({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: { message: 'Connection refused' } })),
        })),
      })),
    })

    const result = await addToQueue({
      roomId: 'room-1',
      sourceId: 'yt-fail',
      source: 'youtube',
      title: 'Fail Song',
      artist: 'Artist',
      duration: 180,
      addedBy: 'user-1',
    })

    expect(result.error).toBeTruthy()
    expect(result.error?.message).toContain('Connection refused')
    expect(result.data).toBeNull()
  })

  it('castVote failure returns error without throwing', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'RLS violation' } })

    const result = await castVote({
      queueItemId: 'item-1',
      userId: 'user-1',
      roomId: 'room-1',
      type: 'upvote',
    })

    expect(result.error).not.toBeNull()
    expect(result.vote).toBeNull()
  })

  it('queue reflects vote-driven reorder after castVote updates upvotes', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const result = await castVote({ queueItemId: 'item-2', userId: 'user-1', roomId: 'room-1', type: 'upvote' })
    expect(result.error).toBeNull()
    expect(result.vote).toBeNull()

    // After vote, item-2 would have 3 upvotes → reorder
    const items: QueueItem[] = [
      makeItem({ id: 'item-1', upvotes: 1 }),
      makeItem({ id: 'item-2', upvotes: 3 }), // now leads
    ]
    const order = computeQueueOrder(items)
    expect(order[0].id).toBe('item-2')
  })
})
