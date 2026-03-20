import * as autoAdvanceLib from '../lib/autoAdvance';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn()
  }
}));

describe('bootstrapQueue Retry Logic', () => {
  const mockRoomId = 'TEST_ROOM';
  const mockQueue: any[] = [
    { id: '1', status: 'pending', upvotes: 5, downvotes: 0, addedAt: new Date().toISOString() }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retry on failure with exponential backoff', async () => {
    const rpcSpy = supabase.rpc as jest.Mock;
    
    // Fail 2 times, then succeed
    rpcSpy
      .mockResolvedValueOnce({ error: { message: 'Transient error 1' } })
      .mockResolvedValueOnce({ error: { message: 'Transient error 2' } })
      .mockResolvedValueOnce({ error: null });

    const result = await autoAdvanceLib.bootstrapQueue({ queue: mockQueue, roomId: mockRoomId });

    expect(result.promotedItem).not.toBeNull();
    expect(rpcSpy).toHaveBeenCalledTimes(3);
    
    // Check that it took some time (at least 500ms + 1000ms if we use 500ms base backoff)
    // For testing purposes, I might want to inject a custom delay function to speed up tests, 
    // but for RED phase, I'll just check it fails to retry at all.
  });
});
