/**
 * Task 3 (RED): Tests for host moderation actions
 * - Mute user (set is_muted in sessions)
 * - Remove user (delete session)
 * - Host skip-override (skip without token cost, host-only)
 */

import {
  muteUser,
  removeUser,
  hostSkipOverride,
  isUserMuted,
} from '../lib/moderation'

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          data: [],
          error: null,
        })),
      })),
      update: jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: null })) })),
      delete: jest.fn(() => ({ eq: jest.fn(() => ({ data: null, error: null })) })),
      insert: jest.fn(() => ({ data: null, error: null })),
    })),
  },
}))

// ---------------------------------------------------------------------------
// muteUser
// ---------------------------------------------------------------------------
describe('muteUser', () => {
  beforeEach(() => jest.clearAllMocks())

  it('mutes a user in the session', async () => {
    const { supabase } = require('../lib/supabase')

    // Verify host
    const mockHostSession = { id: 'hs1', user_id: 'host-id', room_id: 'room-1', is_host: true }
    const mockTargetSession = { id: 'ts1', user_id: 'target-id', room_id: 'room-1', is_host: false }

    let selectCallCount = 0
    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => {
                  selectCallCount++
                  return { data: selectCallCount === 1 ? mockHostSession : mockTargetSession, error: null }
                }),
              })),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ data: null, error: null })),
          })),
        }
      }
      return {}
    })

    const result = await muteUser({
      roomId: 'room-1',
      targetUserId: 'target-id',
      hostId: 'host-id',
    })

    expect(result.error).toBeNull()
    expect(result.muted).toBe(true)
  })

  it('returns error when caller is not host', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 'ns1', user_id: 'nonhost-id', is_host: false },
              error: null,
            })),
          })),
        })),
      })),
    }))

    const result = await muteUser({
      roomId: 'room-1',
      targetUserId: 'target-id',
      hostId: 'nonhost-id',
    })

    expect(result.error).toBeTruthy()
    expect(result.error?.message).toContain('host')
  })

  it('returns error when target session not found', async () => {
    const { supabase } = require('../lib/supabase')

    let callCount = 0
    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => {
                  callCount++
                  if (callCount === 1) return { data: { id: 'hs1', is_host: true }, error: null }
                  return { data: null, error: new Error('Not found') }
                }),
              })),
            })),
          })),
        }
      }
      return {}
    })

    const result = await muteUser({
      roomId: 'room-1',
      targetUserId: 'ghost-id',
      hostId: 'host-id',
    })

    expect(result.error).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// removeUser
// ---------------------------------------------------------------------------
describe('removeUser', () => {
  beforeEach(() => jest.clearAllMocks())

  it('removes a user session from the room', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        let callCount = 0
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => {
                  callCount++
                  if (callCount === 1) return { data: { id: 'hs1', is_host: true }, error: null }
                  return { data: { id: 'ts1', is_host: false }, error: null }
                }),
              })),
            })),
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => ({ data: null, error: null })),
          })),
        }
      }
      return {}
    })

    const result = await removeUser({
      roomId: 'room-1',
      targetUserId: 'target-id',
      hostId: 'host-id',
    })

    expect(result.error).toBeNull()
    expect(result.removed).toBe(true)
  })

  it('prevents host from removing themselves', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({ data: { id: 'hs1', is_host: true }, error: null })),
              })),
            })),
          })),
        }
      }
      return {}
    })

    const result = await removeUser({
      roomId: 'room-1',
      targetUserId: 'host-id',
      hostId: 'host-id',
    })

    expect(result.error).toBeTruthy()
    expect(result.error?.message).toContain('self')
  })

  it('returns error when caller is not host', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: { id: 'ns1', is_host: false }, error: null })),
          })),
        })),
      })),
    }))

    const result = await removeUser({
      roomId: 'room-1',
      targetUserId: 'target-id',
      hostId: 'nonhost-id',
    })

    expect(result.error).toBeTruthy()
    expect(result.error?.message).toContain('host')
  })
})

// ---------------------------------------------------------------------------
// hostSkipOverride – skip without token cost
// ---------------------------------------------------------------------------
describe('hostSkipOverride', () => {
  beforeEach(() => jest.clearAllMocks())

  it('skips track without deducting tokens', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: { id: 'hs1', tokens: 5, is_host: true },
                  error: null,
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'queue_items') {
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({ data: null, error: null })),
          })),
        }
      }
      return {}
    })

    const result = await hostSkipOverride({
      roomId: 'room-1',
      queueItemId: 'item-1',
      hostId: 'host-id',
    })

    expect(result.error).toBeNull()
    expect(result.tokensSpent).toBe(0) // no token cost
  })

  it('returns error when caller is not host', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockImplementation(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: { id: 'ns1', is_host: false }, error: null })),
          })),
        })),
      })),
    }))

    const result = await hostSkipOverride({
      roomId: 'room-1',
      queueItemId: 'item-1',
      hostId: 'nonhost-id',
    })

    expect(result.error).toBeTruthy()
    expect(result.error?.message).toContain('host')
  })
})

// ---------------------------------------------------------------------------
// isUserMuted – check mute status
// ---------------------------------------------------------------------------
describe('isUserMuted', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true when user is muted', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 's1', is_muted: true },
              error: null,
            })),
          })),
        })),
      })),
    })

    const result = await isUserMuted({ roomId: 'room-1', userId: 'u1' })
    expect(result).toBe(true)
  })

  it('returns false when user is not muted', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 's1', is_muted: false },
              error: null,
            })),
          })),
        })),
      })),
    })

    const result = await isUserMuted({ roomId: 'room-1', userId: 'u1' })
    expect(result).toBe(false)
  })
})
