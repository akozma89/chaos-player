import { renderHook, act } from '@testing-library/react'
import { useQueue } from '../hooks/useQueue'
import { supabase } from '../lib/supabase'
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
  getUserVotes: jest.fn().mockResolvedValue({ data: {}, error: null }),
  computeQueueOrder: jest.fn(items => items),
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

describe('useQueue moderation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('tracks active skip request and its veto votes', async () => {
    const items = [makeItem({ id: '1', status: 'playing' })]
    ;(queueLib.getQueueItems as jest.Mock).mockResolvedValue({ data: items, error: null })

    const mockSkipRequest = {
      id: 'req-1',
      room_id: 'room-1',
      queue_item_id: '1',
      status: 'pending',
      expires_at: new Date(Date.now() + 30000).toISOString(),
      veto_threshold: 50
    }

    const mockVetoVotes = [
      { user_id: 'user-2' },
      { user_id: 'user-3' }
    ]

    // Mock supabase calls for loadActiveSkipRequest
    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'skip_requests') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockSkipRequest, error: null })
        }
      }
      if (table === 'veto_votes') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: mockVetoVotes, error: null })
        }
      }
      return mockQueryBuilder
    })

    let result: any
    await act(async () => {
      const { result: hookResult } = renderHook(() => useQueue('room-1', 'user-1'))
      result = hookResult
    })

    expect(result.current.activeSkipRequest).toBeDefined()
    expect(result.current.activeSkipRequest?.id).toBe('req-1')
    expect(result.current.activeSkipRequest?.vetoCount).toBe(2)
  })
})
