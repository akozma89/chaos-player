import { renderHook, act } from '@testing-library/react'
import { useQueue } from '../hooks/useQueue'
import { supabase } from '../lib/supabase'
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

describe('useQueue bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls bootstrapQueue when queue loads and nothing is playing', async () => {
    const items = [makeItem({ id: '1', status: 'pending' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    ;(autoAdvanceLib.bootstrapQueue as jest.Mock).mockResolvedValue({ promotedItem: items[0], error: null })

    await act(async () => {
      renderHook(() => useQueue('room-1', 'user-1'))
    })

    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalled()
  })

  it('does NOT call bootstrapQueue when a track is already playing', async () => {
    const items = [
      makeItem({ id: '1', status: 'playing' }),
      makeItem({ id: '2', status: 'pending' }),
    ]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })

    await act(async () => {
      renderHook(() => useQueue('room-1', 'user-1'))
    })

    expect(autoAdvanceLib.bootstrapQueue).not.toHaveBeenCalled()
  })

  it('only bootstraps once via guard even if multiple real-time updates occur with pending items', async () => {
    const items = [makeItem({ id: '1', status: 'pending' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    ;(autoAdvanceLib.bootstrapQueue as jest.Mock).mockResolvedValue({ promotedItem: items[0], error: null })

    let onUpdate: any
    ;(supabase.channel as jest.Mock).mockReturnValue({
      on: jest.fn().mockImplementation((_event, _filter, callback) => {
        onUpdate = callback
        return { subscribe: jest.fn() }
      }),
      subscribe: jest.fn(),
    })

    await act(async () => {
      renderHook(() => useQueue('room-1', 'user-1'))
    })

    // First load calls it once
    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(1)

    // Second real-time update should NOT call it again if we have a guard
    await act(async () => {
      await onUpdate()
    })

    // If it's 1, the guard works. If it's 2, the guard is missing or broken.
    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(1)
  })

  it('retries bootstrap on subsequent updates if previous attempt failed', async () => {
    const items = [makeItem({ id: '1', status: 'pending' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    
    // First attempt fails
    ;(autoAdvanceLib.bootstrapQueue as jest.Mock)
      .mockResolvedValueOnce({ promotedItem: null, error: new Error('Bootstrap failed') })
      .mockResolvedValueOnce({ promotedItem: items[0], error: null })

    let onUpdate: any
    ;(supabase.channel as jest.Mock).mockReturnValue({
      on: jest.fn().mockImplementation((_event, _filter, callback) => {
        onUpdate = callback
        return { subscribe: jest.fn() }
      }),
      subscribe: jest.fn(),
    })

    await act(async () => {
      renderHook(() => useQueue('room-1', 'user-1'))
    })

    // First load attempt
    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(1)

    // Second update should try again since the first failed
    await act(async () => {
      await onUpdate()
    })

    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(2)
  })

  it('prevents concurrent bootstrap calls within the same component', async () => {
    const items = [makeItem({ id: '1', status: 'pending' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    
    // Slow bootstrapQueue
    let resolvePromote: any
    const promotePromise = new Promise((resolve) => {
      resolvePromote = resolve
    })
    ;(autoAdvanceLib.bootstrapQueue as jest.Mock).mockReturnValue(promotePromise)

    let hookResult: any
    await act(async () => {
      hookResult = renderHook(() => useQueue('room-1', 'user-1'))
    })

    // One call should be in progress
    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(1)

    // Trigger another update immediately while first is still pending
    await act(async () => {
      await hookResult.rerender()
    })

    // Should still only be 1 call
    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(1)

    // Resolve first call
    await act(async () => {
      resolvePromote({ promotedItem: items[0], error: null })
      await promotePromise
    })
  })

  it('allows bootstrap to re-run if queue becomes empty and then a track is added again', async () => {
    // 1. Start empty
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: [], error: null })
    
    let onUpdate: any
    ;(supabase.channel as jest.Mock).mockReturnValue({
      on: jest.fn().mockImplementation((_event, _filter, callback) => {
        onUpdate = callback
        return { subscribe: jest.fn() }
      }),
      subscribe: jest.fn(),
    })

    await act(async () => {
      renderHook(() => useQueue('room-1', 'user-1'))
    })

    expect(autoAdvanceLib.bootstrapQueue).not.toBeCalled()

    // 2. Add first track
    const items = [makeItem({ id: '1', status: 'pending' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    ;(autoAdvanceLib.bootstrapQueue as jest.Mock).mockResolvedValue({ promotedItem: items[0], error: null })

    await act(async () => {
      await onUpdate()
    })

    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(1)

    // 3. Queue becomes empty (e.g. track finished and was pruned)
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: [], error: null })
    await act(async () => {
      await onUpdate()
    })

    // 4. Add another track - should bootstrap again because it was empty
    const moreItems = [makeItem({ id: '2', status: 'pending' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: moreItems, error: null })

    await act(async () => {
      await onUpdate()
    })

    expect(autoAdvanceLib.bootstrapQueue).toHaveBeenCalledTimes(2)
  })
})
