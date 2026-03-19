/**
 * Task 1 (RED): Tests for leaderboard data aggregation
 * - Token scores (tokens spent per user per session)
 * - Vote counts per user per session
 * - Ranked leaderboard entries
 */

import {
  computeLeaderboard,
  getLeaderboard,
  subscribeToLeaderboard,
} from '../lib/leaderboard'
import type { Session } from '../types'

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ data: [], error: null })),
      })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  },
}))

const makeSessions = (overrides: Partial<Session>[] = []): Session[] =>
  overrides.map((o, i) => ({
    id: `session-${i}`,
    roomId: 'room-1',
    userId: `user-${i}`,
    username: `Player ${i}`,
    joinedAt: '2026-01-01T00:00:00Z',
    tokens: 10,
    isHost: false,
    ...o,
  }))

// ---------------------------------------------------------------------------
// computeLeaderboard – pure function, no I/O
// ---------------------------------------------------------------------------
describe('computeLeaderboard', () => {
  it('ranks by tokensSpent descending', () => {
    const sessions = makeSessions([
      { userId: 'u1', username: 'Alice', tokens: 5 },
      { userId: 'u2', username: 'Bob', tokens: 2 },
      { userId: 'u3', username: 'Carol', tokens: 8 },
    ])

    const tokenSpends: Record<string, number> = { u1: 5, u2: 3, u3: 1 }
    const voteCounts: Record<string, number> = { u1: 2, u2: 2, u3: 2 }

    const board = computeLeaderboard(sessions, tokenSpends, {}, voteCounts)

    expect(board[0].userId).toBe('u1') // 5 tokens
    expect(board[1].userId).toBe('u2') // 3 tokens
    expect(board[2].userId).toBe('u3') // 1 token
  })

  it('breaks token ties by vote count descending', () => {
    const sessions = makeSessions([
      { userId: 'u1', username: 'Alice' },
      { userId: 'u2', username: 'Bob' },
    ])

    const tokenSpends: Record<string, number> = { u1: 5, u2: 5 }
    const voteCounts: Record<string, number> = { u1: 3, u2: 7 }

    const board = computeLeaderboard(sessions, tokenSpends, {}, voteCounts)

    expect(board[0].userId).toBe('u2') // more votes
    expect(board[1].userId).toBe('u1')
  })

  it('assigns sequential rank numbers starting at 1', () => {
    const sessions = makeSessions([
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' },
    ])
    const board = computeLeaderboard(sessions, {}, {}, {})
    expect(board.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it('computes engagement score as tokensSpent + voteCount', () => {
    const sessions = makeSessions([{ userId: 'u1', username: 'Alice' }])
    const board = computeLeaderboard(sessions, { u1: 4 }, {}, { u1: 3 })
    expect(board[0].engagementScore).toBe(7)
  })

  it('returns empty array for no sessions', () => {
    expect(computeLeaderboard([], {}, {}, {})).toEqual([])
  })

  it('defaults to 0 for missing spend/vote data', () => {
    const sessions = makeSessions([{ userId: 'u1', username: 'Alice' }])
    const board = computeLeaderboard(sessions, {}, {}, {})
    expect(board[0].tokensSpent).toBe(0)
    expect(board[0].voteCount).toBe(0)
    expect(board[0].engagementScore).toBe(0)
  })

  it('includes host in leaderboard', () => {
    const sessions = makeSessions([
      { userId: 'u1', username: 'Alice', isHost: true },
      { userId: 'u2', username: 'Bob', isHost: false },
    ])
    const board = computeLeaderboard(sessions, { u1: 10, u2: 5 }, {}, {})
    expect(board.some((e) => e.userId === 'u1')).toBe(true)
    expect(board[0].userId).toBe('u1') // host ranks first by token spend
  })
})

// ---------------------------------------------------------------------------
// getLeaderboard – async Supabase fetch
// ---------------------------------------------------------------------------
describe('getLeaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns leaderboard entries for a room', async () => {
    const { supabase } = require('../lib/supabase')

    const mockSessions = [
      { id: 's1', room_id: 'room-1', user_id: 'u1', username: 'Alice', joined_at: '', tokens: 7, is_host: false },
      { id: 's2', room_id: 'room-1', user_id: 'u2', username: 'Bob', joined_at: '', tokens: 3, is_host: false },
    ]
    const mockTokens = [
      { user_id: 'u1', amount: 5 },
      { user_id: 'u1', amount: 3 },
      { user_id: 'u2', amount: 2 },
    ]
    const mockVotes = [
      { user_id: 'u1' },
      { user_id: 'u2' },
      { user_id: 'u2' },
    ]

    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: mockSessions, error: null })),
          })),
        }
      }
      if (table === 'tokens') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: mockTokens, error: null })),
          })),
        }
      }
      if (table === 'votes') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: mockVotes, error: null })),
          })),
        }
      }
      return { select: jest.fn(() => ({ eq: jest.fn(() => ({ data: [], error: null })) })) }
    })

    const result = await getLeaderboard('room-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    // u1 spent 8 tokens, u2 spent 2 => u1 ranked first
    expect(result.data![0].userId).toBe('u1')
    expect(result.data![0].tokensSpent).toBe(8)
  })

  it('returns leaderboard entries for a room, separating earned vs spent tokens', async () => {
    const { supabase } = require('../lib/supabase')

    const mockSessions = [
      { id: 's1', room_id: 'room-1', user_id: 'u1', username: 'Alice', joined_at: '', tokens: 7, is_host: false },
    ]
    const mockTokens = [
      { user_id: 'u1', amount: 5, action: 'skip' },
      { user_id: 'u1', amount: 3, action: 'earn' },
    ]
    const mockVotes = [
      { user_id: 'u1' },
    ]

    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: mockSessions, error: null })),
          })),
        }
      }
      if (table === 'tokens') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: mockTokens, error: null })),
          })),
        }
      }
      if (table === 'votes') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ data: mockVotes, error: null })),
          })),
        }
      }
      return { select: jest.fn(() => ({ eq: jest.fn(() => ({ data: [], error: null })) })) }
    })

    const result = await getLeaderboard('room-1')

    expect(result.error).toBeNull()
    expect(result.data![0].tokensSpent).toBe(5)
    expect(result.data![0].tokensEarned).toBe(3)
  })

  it('returns error when sessions fetch fails', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ data: null, error: new Error('DB error') })),
      })),
    })

    const result = await getLeaderboard('room-1')
    expect(result.error).toBeTruthy()
    expect(result.data).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// subscribeToLeaderboard – real-time channel
// ---------------------------------------------------------------------------
describe('subscribeToLeaderboard', () => {
  it('creates a channel subscription and returns unsubscribe fn', () => {
    const { supabase } = require('../lib/supabase')

    const mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    }
    supabase.channel.mockReturnValue(mockChannel)

    const callback = jest.fn()
    const unsubscribe = subscribeToLeaderboard('room-1', callback)

    expect(supabase.channel).toHaveBeenCalled()
    expect(mockChannel.on).toHaveBeenCalled()
    expect(mockChannel.subscribe).toHaveBeenCalled()
    expect(typeof unsubscribe).toBe('function')
  })

  it('calls removeChannel when unsubscribed', () => {
    const { supabase } = require('../lib/supabase')

    const mockChannel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn() }
    supabase.channel.mockReturnValue(mockChannel)

    const unsubscribe = subscribeToLeaderboard('room-1', jest.fn())
    unsubscribe()

    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel)
  })
})
