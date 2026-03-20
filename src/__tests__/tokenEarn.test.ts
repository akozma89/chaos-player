/**
 * Task 1 (RED): Tests for Token Earn Loop (crowd pleaser mechanic)
 * - Award CROWD_PLEASER_REWARD tokens when net votes reach +3 threshold
 * - Idempotent: only award once per queue item
 * - Persist earn record to tokens ledger
 * - Credit session token balance
 */

import {
  checkAndAwardCrowdPleaser,
  CROWD_PLEASER_THRESHOLD,
  CROWD_PLEASER_REWARD,
} from '../lib/tokenEarn'

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))


describe('CROWD_PLEASER constants', () => {
  it('has threshold of 3 net votes', () => {
    expect(CROWD_PLEASER_THRESHOLD).toBe(3)
  })

  it('has reward of 3 tokens', () => {
    expect(CROWD_PLEASER_REWARD).toBe(3)
  })
})

describe('checkAndAwardCrowdPleaser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('awards tokens when net votes meet threshold', async () => {
    const { supabase } = require('../lib/supabase')

    // queue_item: upvotes=5, downvotes=2 => net=3, meets threshold
    const queueItem = { id: 'qi-1', room_id: 'room-1', added_by: 'user-1', upvotes: 5, downvotes: 2 }
    const session = { id: 'sess-1', user_id: 'user-1', room_id: 'room-1', tokens: 10 }

    let updateCalled = false
    let insertCalled = false

    supabase.from.mockImplementation((table: string) => {
      if (table === 'queue_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: queueItem, error: null }),
        }
      }
      if (table === 'tokens') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue({ data: [], error: null })
            }))
          })),
          insert: jest.fn().mockImplementation(() => {
            insertCalled = true
            return Promise.resolve({ data: {}, error: null })
          }),
        }
      }
      if (table === 'sessions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: session, error: null }),
          update: jest.fn().mockImplementation(() => {
            updateCalled = true
            return { eq: jest.fn().mockResolvedValue({ data: {}, error: null }) }
          }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
    })

    const result = await checkAndAwardCrowdPleaser({ queueItemId: 'qi-1', roomId: 'room-1' })

    expect(result.awarded).toBe(true)
    expect(result.tokensAwarded).toBe(CROWD_PLEASER_REWARD)
    expect(result.userId).toBe('user-1')
    expect(insertCalled).toBe(true)
    expect(updateCalled).toBe(true)
  })

  it('credits correct token amount to session balance', async () => {
    const { supabase } = require('../lib/supabase')

    const queueItem = { id: 'qi-1', room_id: 'room-1', added_by: 'user-1', upvotes: 4, downvotes: 0 }
    const session = { id: 'sess-1', user_id: 'user-1', room_id: 'room-1', tokens: 7 }

    let updatedTokens: number | null = null

    supabase.from.mockImplementation((table: string) => {
      if (table === 'queue_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: queueItem, error: null }),
        }
      }
      if (table === 'tokens') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockImplementation(() => ({
                eq: jest.fn().mockResolvedValue({ data: [], error: null })
            }))
          })),
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }
      if (table === 'sessions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: session, error: null }),
          update: jest.fn().mockImplementation((data: Record<string, number>) => {
            updatedTokens = data.tokens
            return { eq: jest.fn().mockResolvedValue({ data: {}, error: null }) }
          }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
    })

    await checkAndAwardCrowdPleaser({ queueItemId: 'qi-1', roomId: 'room-1' })
    expect(updatedTokens).toBe(7 + CROWD_PLEASER_REWARD)
  })

  describe('Multi-tier Rewards', () => {
    it('awards Vibe Architect (+7) when net votes reach 7', async () => {
      const { supabase } = require('../lib/supabase')
      const queueItem = { id: 'qi-7', room_id: 'room-1', added_by: 'user-1', upvotes: 7, downvotes: 0 }
      const session = { id: 'sess-1', user_id: 'user-1', room_id: 'room-1', tokens: 10 }

      supabase.from.mockImplementation((table: string) => {
        if (table === 'queue_items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: queueItem, error: null }),
          }
        }
        if (table === 'tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation(() => ({
              eq: jest.fn().mockImplementation(() => ({
                 eq: jest.fn().mockResolvedValue({ data: [], error: null })
              }))
            })),
            insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
          }
        }
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: session, error: null }),
            update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: {}, error: null }) }),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
      })

      const result = await checkAndAwardCrowdPleaser({ queueItemId: 'qi-7', roomId: 'room-1' })

      expect(result.awarded).toBe(true)
      expect(result.tokensAwarded).toBe(7)
    })

    it('awards Chaos Legend (+15) when net votes reach 15', async () => {
      const { supabase } = require('../lib/supabase')
      const queueItem = { id: 'qi-15', room_id: 'room-1', added_by: 'user-1', upvotes: 15, downvotes: 0 }
      const session = { id: 'sess-1', user_id: 'user-1', room_id: 'room-1', tokens: 10 }

      supabase.from.mockImplementation((table: string) => {
        if (table === 'queue_items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: queueItem, error: null }),
          }
        }
        if (table === 'tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation(() => ({
              eq: jest.fn().mockImplementation(() => ({
                 eq: jest.fn().mockResolvedValue({ data: [], error: null })
              }))
            })),
            insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
          }
        }
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: session, error: null }),
            update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: {}, error: null }) }),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
      })

      const result = await checkAndAwardCrowdPleaser({ queueItemId: 'qi-15', roomId: 'room-1' })

      expect(result.awarded).toBe(true)
      expect(result.tokensAwarded).toBe(15)
    })
  })
})
