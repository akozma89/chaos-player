import { promoteToPlaying, advanceQueue, pickNextTrack } from '../lib/autoAdvance'
import { supabase } from '../lib/supabase'
import type { QueueItem } from '../types'

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
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

describe('playlist bootstrap and advance race conditions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('promoteToPlaying (Bootstrap)', () => {
    it('should NOT call RPC if no pending items', async () => {
      const queue: QueueItem[] = []
      const result = await promoteToPlaying({ queue, roomId: 'room-1' })
      expect(supabase.rpc).not.toHaveBeenCalled()
      expect(result.promotedItem).toBeNull()
    })

    it('should call RPC if pending items exist', async () => {
      const queue = [makeItem({ id: '1', status: 'pending' })]
      ;(supabase.rpc as jest.Mock).mockResolvedValue({ error: null })
      
      const result = await promoteToPlaying({ queue, roomId: 'room-1' })
      
      expect(supabase.rpc).toHaveBeenCalledWith('promote_to_playing', { p_room_id: 'room-1' })
      expect(result.promotedItem?.id).toBe('1')
    })

    it('should return error if RPC fails', async () => {
      const queue = [makeItem({ id: '1', status: 'pending' })]
      ;(supabase.rpc as jest.Mock).mockResolvedValue({ error: { message: 'RPC Error' } })
      
      const result = await promoteToPlaying({ queue, roomId: 'room-1' })
      
      expect(result.error?.message).toBe('RPC Error')
      expect(result.promotedItem).toBeNull()
    })
  })

  describe('advanceQueue', () => {
    it('should call advance_queue RPC', async () => {
      const queue = [
        makeItem({ id: '1', status: 'playing' }),
        makeItem({ id: '2', status: 'pending' }),
      ]
      ;(supabase.rpc as jest.Mock).mockResolvedValue({ error: null })

      const result = await advanceQueue({ 
        currentItemId: '1', 
        queue, 
        roomId: 'room-1' 
      })

      expect(supabase.rpc).toHaveBeenCalledWith('advance_queue', {
        p_current_item_id: '1',
        p_room_id: 'room-1',
      })
      expect(result.nextItem?.id).toBe('2')
    })
  })

  describe('pickNextTrack logic', () => {
    it('picks highest net votes', () => {
      const queue = [
        makeItem({ id: '1', upvotes: 5, downvotes: 0, status: 'pending' }),
        makeItem({ id: '2', upvotes: 10, downvotes: 0, status: 'pending' }),
      ]
      const next = pickNextTrack(queue)
      expect(next?.id).toBe('2')
    })

    it('breaks ties with addedAt (FIFO)', () => {
      const queue = [
        makeItem({ id: '1', upvotes: 5, addedAt: '2026-01-01T00:00:05Z', status: 'pending' }),
        makeItem({ id: '2', upvotes: 5, addedAt: '2026-01-01T00:00:01Z', status: 'pending' }),
      ]
      const next = pickNextTrack(queue)
      expect(next?.id).toBe('2')
    })
  })
})
