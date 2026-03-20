import { getPublicRooms, createRoom } from '../lib/rooms'

// Mock Supabase client
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: [],
                count: 0,
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
    rpc: jest.fn(),
  },
}))

describe('getPublicRooms', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch public active rooms ordered by creation date', async () => {
    const { supabase } = require('../lib/supabase')
    
    const mockRooms = [
      { id: '1', name: 'Public Room 1', host_id: 'h1', code: 'PUB001', is_public: true, is_active: true, created_at: '2021-01-01', updated_at: '2021-01-01' },
      { id: '2', name: 'Public Room 2', host_id: 'h2', code: 'PUB002', is_public: true, is_active: true, created_at: '2021-01-02', updated_at: '2021-01-02' },
    ]

    const mockRange = jest.fn().mockResolvedValue({ data: mockRooms, count: 2, error: null })
    const mockOrder = jest.fn(() => ({ range: mockRange }))
    const mockEqSecond = jest.fn(() => ({ order: mockOrder }))
    const mockEqFirst = jest.fn(() => ({ eq: mockEqSecond }))
    
    supabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: mockEqFirst,
      })),
    })

    const result = await getPublicRooms({ limit: 5 })

    expect(result.rooms).toHaveLength(2)
    expect(supabase.from).toHaveBeenCalledWith('rooms')
    expect(mockEqFirst).toHaveBeenCalledWith('is_active', true)
    expect(mockEqSecond).toHaveBeenCalledWith('is_public', true)
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockRange).toHaveBeenCalledWith(0, 4)
  })

  it('should return error if fetch fails', async () => {
    const { supabase } = require('../lib/supabase')
    
    const mockRange = jest.fn().mockResolvedValue({ data: null, count: 0, error: { message: 'Fetch error' } })
    const mockOrder = jest.fn(() => ({ range: mockRange }))
    const mockEqSecond = jest.fn(() => ({ order: mockOrder }))
    const mockEqFirst = jest.fn(() => ({ eq: mockEqSecond }))
    
    supabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: mockEqFirst,
      })),
    })

    const result = await getPublicRooms()

    expect(result.rooms).toHaveLength(0)
    expect(result.error).toBeDefined()
  })
})

describe('createRoom with visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a private room when isPublic is false', async () => {
    const { supabase } = require('../lib/supabase')
    
    supabase.rpc.mockResolvedValue({
      data: { 
        room: { id: 'room-1', name: 'Private Room', is_public: false, host_id: 'host-1', code: 'PRIV01', created_at: '2021-01-01', updated_at: '2021-01-01', is_active: true },
        session: { id: 'sess-1' }
      },
      error: null
    })

    const result = await createRoom({ 
      name: 'Private Room', 
      hostId: 'host-1', 
      username: 'Host', 
      isPublic: false 
    })

    expect(result.data?.isPublic).toBe(false)
    expect(supabase.rpc).toHaveBeenCalledWith('create_room', expect.objectContaining({
      p_is_public: false
    }))
  })
})
