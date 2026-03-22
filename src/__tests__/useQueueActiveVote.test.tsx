import { renderHook, act } from '@testing-library/react'
import { useQueue } from '../hooks/useQueue'
import * as queueLib from '../lib/queue'
import type { QueueItem } from '../types'

const mockQueryBuilder: any = {
  select: jest.fn().mockImplementation(() => mockQueryBuilder),
  eq: jest.fn().mockImplementation(() => mockQueryBuilder),
  single: jest.fn().mockImplementation(() => mockQueryBuilder),
  then: jest.fn((resolve) => resolve({ data: [], error: null }))
};

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockQueryBuilder),
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
  computeVoteDelta: jest.fn((type, prev) => {
      if (!prev) return { upvoteDelta: type === 'upvote' ? 1 : 0, downvoteDelta: type === 'downvote' ? 1 : 0 }
      if (prev === type) return { upvoteDelta: 0, downvoteDelta: 0 }
      return { upvoteDelta: type === 'upvote' ? 1 : -1, downvoteDelta: type === 'downvote' ? 1 : -1 }
  }),
  getUserVotes: jest.fn(),
}))

jest.mock('../lib/tokenEarn', () => ({
  checkAndAwardCrowdPleaser: jest.fn().mockResolvedValue({ awarded: false, tokensAwarded: 0 }),
}))

jest.mock('../lib/autoAdvance', () => ({
  advanceQueue: jest.fn().mockResolvedValue({ error: null }),
  bootstrapQueue: jest.fn().mockResolvedValue({ promotedItem: null, error: null }),
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

import * as tokenEarnLib from '../lib/tokenEarn'

describe('useQueue active vote tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls checkAndAwardCrowdPleaser after a successful vote', async () => {
    const items = [makeItem({ id: '1' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    ;(queueLib.getUserVotes as jest.Mock).mockResolvedValue({ data: {}, error: null })
    ;(queueLib.castVote as jest.Mock).mockResolvedValue({ vote: {}, error: null })

    let hookResult: any
    await act(async () => {
      const { result } = renderHook(() => useQueue('room-1', 'user-1'))
      hookResult = result
    })

    await act(async () => {
      await hookResult.current.vote('1', 'upvote')
    })

    expect(tokenEarnLib.checkAndAwardCrowdPleaser).toHaveBeenCalledWith({
      queueItemId: '1',
      roomId: 'room-1',
    })
  })

  it('provides the user votes for items', async () => {
    const items = [makeItem({ id: '1' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    ;(queueLib.getUserVotes as jest.Mock).mockResolvedValue({ data: { '1': 'upvote' }, error: null })

    let result: any
    await act(async () => {
      const { result: hookResult } = renderHook(() => useQueue('room-1', 'user-1'))
      result = hookResult
    })

    // This is the failing part: userVotes should exist and have item '1' as 'upvote'
    expect(result.current.userVotes).toBeDefined()
    expect(result.current.userVotes['1']).toBe('upvote')
  })

  it('updates userVotes optimistically when voting', async () => {
    const items = [makeItem({ id: '1' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })
    ;(queueLib.getUserVotes as jest.Mock).mockResolvedValue({ data: {}, error: null })
    ;(queueLib.castVote as jest.Mock).mockResolvedValue({ vote: {}, error: null })

    let hookResult: any
    await act(async () => {
      const { result } = renderHook(() => useQueue('room-1', 'user-1'))
      hookResult = result
    })

    await act(async () => {
      await hookResult.current.vote('1', 'downvote')
    })

    expect(hookResult.current.userVotes['1']).toBe('downvote')
  })
})
