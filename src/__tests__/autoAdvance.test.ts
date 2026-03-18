/**
 * Task 5 (RED): Tests for democratic auto-advance logic
 * Tests: pick highest net-vote pending item, broadcast via Supabase Realtime
 */

import { pickNextTrack, advanceQueue } from '../lib/autoAdvance'
import type { QueueItem } from '../types'

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({
      send: jest.fn(() => Promise.resolve()),
    })),
  },
}))

const makeItem = (overrides: Partial<QueueItem>): QueueItem => ({
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
  ...overrides,
})

describe('pickNextTrack', () => {
  it('returns highest net-vote pending item', () => {
    const items: QueueItem[] = [
      makeItem({ id: '1', upvotes: 2, downvotes: 1 }),  // net 1
      makeItem({ id: '2', upvotes: 5, downvotes: 0 }),  // net 5 ← winner
      makeItem({ id: '3', upvotes: 1, downvotes: 3 }),  // net -2
    ]

    const next = pickNextTrack(items)
    expect(next?.id).toBe('2')
  })

  it('returns null when no pending items exist', () => {
    const items: QueueItem[] = [
      makeItem({ id: '1', status: 'completed' }),
      makeItem({ id: '2', status: 'skipped' }),
    ]

    expect(pickNextTrack(items)).toBeNull()
  })

  it('breaks ties by FIFO (earlier addedAt wins)', () => {
    const items: QueueItem[] = [
      makeItem({ id: '1', upvotes: 3, downvotes: 1, addedAt: '2026-01-01T00:00:02Z' }),
      makeItem({ id: '2', upvotes: 3, downvotes: 1, addedAt: '2026-01-01T00:00:01Z' }), // earlier
    ]

    const next = pickNextTrack(items)
    expect(next?.id).toBe('2')
  })

  it('skips playing items when picking next', () => {
    const items: QueueItem[] = [
      makeItem({ id: '1', status: 'playing', upvotes: 10 }),
      makeItem({ id: '2', status: 'pending', upvotes: 1 }),
    ]

    const next = pickNextTrack(items)
    expect(next?.id).toBe('2')
  })
})

describe('advanceQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks current item as completed and next as playing', async () => {
    const { supabase } = require('../lib/supabase')

    const mockUpdate = jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: null })) }))
    supabase.from.mockReturnValue({ update: mockUpdate })

    const items: QueueItem[] = [
      makeItem({ id: 'current', status: 'playing' }),
      makeItem({ id: 'next', status: 'pending', upvotes: 3 }),
    ]

    const result = await advanceQueue({ currentItemId: 'current', queue: items, roomId: 'room-1' })

    expect(result.error).toBeNull()
    expect(result.nextItem?.id).toBe('next')
    expect(supabase.from).toHaveBeenCalledWith('queue_items')
  })

  it('returns null nextItem when queue is empty', async () => {
    const { supabase } = require('../lib/supabase')

    const mockUpdate = jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: null })) }))
    supabase.from.mockReturnValue({ update: mockUpdate })

    const items: QueueItem[] = [
      makeItem({ id: 'current', status: 'playing' }),
    ]

    const result = await advanceQueue({ currentItemId: 'current', queue: items, roomId: 'room-1' })

    expect(result.nextItem).toBeNull()
    expect(result.error).toBeNull()
  })

  it('returns error when supabase update fails', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockReturnValue({
      update: jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: { message: 'DB error' } })) })),
    })

    const items: QueueItem[] = [
      makeItem({ id: 'current', status: 'playing' }),
      makeItem({ id: 'next', status: 'pending' }),
    ]

    const result = await advanceQueue({ currentItemId: 'current', queue: items, roomId: 'room-1' })

    expect(result.error).toBeTruthy()
  })
})
