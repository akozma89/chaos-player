import { addToQueue } from '../lib/queue'
import { bootstrapQueue, advanceQueue } from '../lib/autoAdvance'

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}))

const makeItem = (overrides: any) => ({
  id: 'item-1',
  room_id: 'room-1',
  video_id: 'v1',
  source: 'youtube',
  title: 'Track',
  artist: 'Artist',
  duration: 200,
  added_by: 'user-1',
  added_at: '2026-01-01T00:00:00Z',
  position: 0,
  upvotes: 0,
  downvotes: 0,
  status: 'pending',
  playing_since: null,
  ...overrides,
})

describe('Playback Loop Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('completes a full playback cycle: add -> bootstrap -> advance', async () => {
    const { supabase } = require('../lib/supabase')

    // 1. Add first track
    const newItem = makeItem({ id: 'item-1', status: 'pending' })
    supabase.from.mockReturnValueOnce({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: newItem, error: null })),
        })),
      })),
    })

    const addResult = await addToQueue({
      roomId: 'room-1',
      sourceId: 'v1',
      source: 'youtube',
      title: 'Track',
      artist: 'Artist',
      duration: 200,
      addedBy: 'user-1',
    })

    expect(addResult.data?.status).toBe('pending')

    // 2. Bootstrap (nothing playing -> promote top pending)
    const queue = [addResult.data!]
    supabase.rpc.mockResolvedValueOnce({ error: null }) // promote_item_by_id

    const bootstrapResult = await bootstrapQueue({ queue, roomId: 'room-1' })
    expect(bootstrapResult.promotedItem?.id).toBe('item-1')
    expect(bootstrapResult.promotedItem?.status).toBe('playing')

    // 3. Add second track
    const secondItem = makeItem({ id: 'item-2', status: 'pending' })
    const currentQueue = [
      { ...addResult.data!, status: 'playing' as const },
      { ...secondItem, id: 'item-2', roomId: 'room-1', sourceId: 'v2', status: 'pending' as const }
    ]

    // 4. Advance (current playing finishes -> next pending starts)
    supabase.rpc.mockResolvedValueOnce({ error: null }) // advance_queue
    
    const advanceResult = await advanceQueue({
      currentItemId: 'item-1',
      queue: currentQueue as any,
      roomId: 'room-1'
    })

    expect(advanceResult.error).toBeNull()
    expect(advanceResult.nextItem?.id).toBe('item-2')
  })
})
