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
            eq: jest.fn().mockResolvedValue({ data: [], error: null }), // no prior earn
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

  it('does not award when net votes below threshold', async () => {
    const { supabase } = require('../lib/supabase')

    // upvotes=3, downvotes=2 => net=1, below threshold
    const queueItem = { id: 'qi-1', room_id: 'room-1', added_by: 'user-1', upvotes: 3, downvotes: 2 }

    supabase.from.mockImplementation((table: string) => {
      if (table === 'queue_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: queueItem, error: null }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
    })

    const result = await checkAndAwardCrowdPleaser({ queueItemId: 'qi-1', roomId: 'room-1' })

    expect(result.awarded).toBe(false)
    expect(result.tokensAwarded).toBe(0)
  })

  it('is idempotent: does not award twice for same queue item', async () => {
    const { supabase } = require('../lib/supabase')

    const queueItem = { id: 'qi-1', room_id: 'room-1', added_by: 'user-1', upvotes: 5, downvotes: 2 }
    const existingEarn = [{ id: 'tok-1', user_id: 'user-1', action: 'earn', queue_item_id: 'qi-1' }]

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
            eq: jest.fn().mockResolvedValue({ data: existingEarn, error: null }),
          })),
          insert: jest.fn().mockImplementation(() => {
            insertCalled = true
            return Promise.resolve({ data: {}, error: null })
          }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
    })

    const result = await checkAndAwardCrowdPleaser({ queueItemId: 'qi-1', roomId: 'room-1' })

    expect(result.awarded).toBe(false)
    expect(result.alreadyAwarded).toBe(true)
    expect(insertCalled).toBe(false)
  })

  it('returns error when queue item not found', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation((table: string) => {
      if (table === 'queue_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
    })

    const result = await checkAndAwardCrowdPleaser({ queueItemId: 'nonexistent', roomId: 'room-1' })

    expect(result.awarded).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('awards exactly at threshold (net=3)', async () => {
    const { supabase } = require('../lib/supabase')

    // upvotes=3, downvotes=0 => net=3, exactly at threshold
    const queueItem = { id: 'qi-2', room_id: 'room-1', added_by: 'user-2', upvotes: 3, downvotes: 0 }
    const session = { id: 'sess-2', user_id: 'user-2', room_id: 'room-1', tokens: 5 }

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
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        }
      }
      if (table === 'sessions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: session, error: null }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
    })

    const result = await checkAndAwardCrowdPleaser({ queueItemId: 'qi-2', roomId: 'room-1' })

    expect(result.awarded).toBe(true)
  })

  it('does not award at net=2 (below threshold)', async () => {
    const { supabase } = require('../lib/supabase')

    const queueItem = { id: 'qi-3', room_id: 'room-1', added_by: 'user-3', upvotes: 4, downvotes: 2 }

    supabase.from.mockImplementation((table: string) => {
      if (table === 'queue_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: queueItem, error: null }),
        }
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
    })

    const result = await checkAndAwardCrowdPleaser({ queueItemId: 'qi-3', roomId: 'room-1' })

    expect(result.awarded).toBe(false)
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
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
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

    // session had 7 tokens, should now have 7 + CROWD_PLEASER_REWARD = 10
    expect(updatedTokens).toBe(7 + CROWD_PLEASER_REWARD)
  })
})
