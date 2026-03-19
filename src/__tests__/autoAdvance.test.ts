import { promoteToPlaying } from '../lib/autoAdvance'
import { supabase } from '../lib/supabase'

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  }
}))

describe('promoteToPlaying', () => {
  it('calls RPC to promote a specific item by ID', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValue({ error: null })
    
    await promoteToPlaying('item-123', 'room-456')
    
    expect(supabase.rpc).toHaveBeenCalledWith('promote_item_by_id', {
      p_item_id: 'item-123',
      p_room_id: 'room-456'
    })
  })

  it('returns error if RPC fails', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValue({ error: { message: 'Failed' } })
    
    const { error } = await promoteToPlaying('item-123', 'room-456')
    
    expect(error?.message).toBe('Failed')
  })
})
