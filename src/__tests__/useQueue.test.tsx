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
  computeQueueOrder: jest.fn(items => items),
  computeVoteDelta: jest.fn(() => ({ upvoteDelta: 0, downvoteDelta: 0 })),
}))

jest.mock('../lib/autoAdvance', () => ({
  advanceQueue: jest.fn(),
  promoteToPlaying: jest.fn(),
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

  it('calls promoteToPlaying when queue loads and nothing is playing', async () => {
    const items = [makeItem({ id: '1', status: 'pending' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    ;(autoAdvanceLib.promoteToPlaying as jest.Mock).mockResolvedValue({ promotedItem: items[0], error: null })

    await act(async () => {
      renderHook(() => useQueue('room-1', 'user-1'))
    })

    expect(autoAdvanceLib.promoteToPlaying).toHaveBeenCalled()
  })

  it('does NOT call promoteToPlaying when a track is already playing', async () => {
    const items = [
      makeItem({ id: '1', status: 'playing' }),
      makeItem({ id: '2', status: 'pending' }),
    ]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })

    await act(async () => {
      renderHook(() => useQueue('room-1', 'user-1'))
    })

    expect(autoAdvanceLib.promoteToPlaying).not.toHaveBeenCalled()
  })

  it('only bootstraps once via guard even if multiple real-time updates occur with pending items', async () => {
    const items = [makeItem({ id: '1', status: 'pending' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    ;(autoAdvanceLib.promoteToPlaying as jest.Mock).mockResolvedValue({ promotedItem: items[0], error: null })

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
    expect(autoAdvanceLib.promoteToPlaying).toHaveBeenCalledTimes(1)

    // Second real-time update should NOT call it again if we have a guard
    await act(async () => {
      await onUpdate()
    })

    // If it's 1, the guard works. If it's 2, the guard is missing or broken.
    expect(autoAdvanceLib.promoteToPlaying).toHaveBeenCalledTimes(1)
  })
})
