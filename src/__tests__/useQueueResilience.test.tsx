import { renderHook, act } from '@testing-library/react'
import { useQueue } from '../hooks/useQueue'
import * as queueLib from '../lib/queue'
import * as autoAdvanceLib from '../lib/autoAdvance'
import type { QueueItem } from '../types'

jest.mock('../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  },
}))

jest.mock('../lib/queue', () => ({
  getQueueItems: jest.fn(),
  castVote: jest.fn(),
  getUserVotes: jest.fn().mockResolvedValue({ data: {}, error: null }),
  computeQueueOrder: jest.fn(items => items),
  computeVoteDelta: jest.fn(() => ({ upvoteDelta: 0, downvoteDelta: 0 })),
}))

jest.mock('../lib/autoAdvance', () => ({
  advanceQueue: jest.fn(),
  bootstrapQueue: jest.fn(),
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
  playingSince: null,
  ...overrides,
} as QueueItem)

describe('useQueue Resilient Bootstrap v2', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('attempts to bootstrap a NEW top track if the previous top track bootstrap failed', async () => {
    const itemA = makeItem({ id: 'item-A', status: 'pending' })
    const itemB = makeItem({ id: 'item-B', status: 'pending' })

    // 1. Load with Item A at top. Bootstrap fails.
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValueOnce({ data: [itemA], error: null })
    ;(autoAdvanceLib.bootstrapQueue as jest.Mock).mockResolvedValueOnce({ error: new Error('A failed') })

    const { result } = renderHook(() => useQueue('room-1', 'user-1'))

    await act(async () => {
      // Trigger initial load
    })

    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledWith(expect.objectContaining({ queue: [itemA] }))
    
    // 2. Item B is added and becomes the top (e.g. higher votes or earlier addedAt, 
    // but in our mock computeQueueOrder just returns items as is, so we'll just put B first).
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: [itemB, itemA], error: null })
    ;(autoAdvanceLib.bootstrapQueue as jest.Mock).mockResolvedValueOnce({ promotedItem: itemB, error: null })

    await act(async () => {
      // Simulate real-time update or manual refresh
      await result.current.refresh()
    })

    // It should attempt to bootstrap Item B because it's a DIFFERENT top track
    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(2)
    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenLastCalledWith(expect.objectContaining({ queue: [itemB, itemA] }))
  })

  it('sets isSyncing to true during bootstrap and false when item starts playing', async () => {
    const itemA = makeItem({ id: 'item-A', status: 'pending' })
    const playingA = makeItem({ id: 'item-A', status: 'playing' })

    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValueOnce({ data: [itemA], error: null })
    
    // Slow bootstrap
    let resolveBootstrap: any
    const bootstrapPromise = new Promise((resolve) => {
        resolveBootstrap = resolve
    })
    ;(autoAdvanceLib.bootstrapQueue as jest.Mock).mockReturnValue(bootstrapPromise)

    const { result } = renderHook(() => useQueue('room-1', 'user-1'))

    await act(async () => {
        // Initial load
    })

    expect(result.current.isSyncing).toBe(true)

    // Simulate success
    await act(async () => {
        resolveBootstrap({ promotedItem: playingA, error: null })
        await bootstrapPromise
    })

    // On next update, if itemA is playing, isSyncing should be false
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValueOnce({ data: [playingA], error: null })
    await act(async () => {
        await result.current.refresh()
    })

    expect(result.current.isSyncing).toBe(false)
  })
})
