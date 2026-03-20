/**
 * Task 3 (RED): Tests for room creation & anonymous guest join flow
 */

import { createRoom, joinRoom, getRoomByCode, generateRoomCode } from '../lib/rooms'

// Mock Supabase client
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInAnonymously: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn() })) })),
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })),
      update: jest.fn(() => ({ eq: jest.fn() })),
    })),
    rpc: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({ subscribe: jest.fn() })),
    })),
  },
}))

describe('generateRoomCode', () => {
  it('should generate a 6-character uppercase alphanumeric code', () => {
    const code = generateRoomCode()
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('should generate unique codes on successive calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()))
    // Very unlikely to have many collisions in 100 unique codes
    expect(codes.size).toBeGreaterThan(90)
  })
})

describe('createRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a room with a unique code', async () => {
    const { supabase } = require('../lib/supabase')

    const mockRoom = {
      id: 'room-uuid',
      name: 'Party Room',
      code: 'ABC123',
      host_id: 'host-uuid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      is_public: true,
    }

    const mockSession = {
      id: 'session-uuid',
    }

    supabase.rpc.mockResolvedValue({
      data: { room: mockRoom, session: mockSession },
      error: null,
    })

    const result = await createRoom({ name: 'Party Room', hostId: 'host-uuid', username: 'HostUser' })

    expect(result.data).toBeDefined()
    expect(result.error).toBeNull()
    expect(result.data?.name).toBe('Party Room')
    expect(supabase.rpc).toHaveBeenCalledWith('create_room', expect.anything())
  })

  it('should return error when creation fails', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    const result = await createRoom({ name: 'Party Room', hostId: 'host-uuid', username: 'HostUser' })

    expect(result.data).toBeNull()
    expect(result.error).toBeTruthy()
  })
})

describe('joinRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should join an existing room anonymously and receive tokens', async () => {
    const { supabase } = require('../lib/supabase')

    const mockRpcResult = {
      session: {
        id: 'session-uuid',
        room_id: 'room-uuid',
        user_id: 'anon-user-uuid',
        username: 'Guest1',
        tokens: 10,
        is_host: false,
        joined_at: new Date().toISOString(),
      },
      room: {
        id: 'room-uuid',
        name: 'Party Room',
        code: 'ABC123',
        host_id: 'host-uuid',
        is_public: true,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }

    supabase.rpc.mockResolvedValue({ data: mockRpcResult, error: null })

    const result = await joinRoom({ roomCode: 'ABC123', username: 'Guest1', userId: 'anon-user-uuid' })

    expect(result.session).toBeDefined()
    expect(result.session?.tokens).toBe(10)
    expect(result.error).toBeNull()
  })

  it('should return error for inactive room', async () => {
    const { supabase } = require('../lib/supabase')

    supabase.rpc.mockResolvedValue({ data: { error: 'Room not found' }, error: null })

    const result = await joinRoom({ roomCode: 'INVALID', username: 'Guest1', userId: 'anon-user' })

    expect(result.session).toBeNull()
    expect(result.error).toBeTruthy()
  })
})

describe('getRoomByCode', () => {
  it('should fetch room by 6-char code', async () => {
    const { supabase } = require('../lib/supabase')

    const mockRoom = { id: 'room-uuid', code: 'ABC123', isActive: true }

    supabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: mockRoom, error: null })),
        })),
      })),
    })

    const result = await getRoomByCode('ABC123')

    expect(result.data?.code).toBe('ABC123')
    expect(result.error).toBeNull()
  })
})
