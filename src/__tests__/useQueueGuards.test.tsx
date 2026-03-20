import { renderHook, waitFor } from '@testing-library/react';
import { useQueue } from '../hooks/useQueue';
import * as autoAdvanceLib from '../lib/autoAdvance';
import * as queueLib from '../lib/queue';

jest.mock('../lib/autoAdvance');
jest.mock('../lib/queue');

describe('useQueue Track-Specific Guards', () => {
  const mockRoomCode = 'TEST12';
  const mockUserId = 'USER123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not re-bootstrap the same track if already in progress', async () => {
    const bootstrapSpy = jest.spyOn(autoAdvanceLib, 'bootstrapQueue');
    const getQueueSpy = jest.spyOn(queueLib, 'getQueueItems');
    const getVotesSpy = jest.spyOn(queueLib, 'getUserVotes');
    
    // Mock computeQueueOrder behavior
    jest.spyOn(queueLib, 'computeQueueOrder').mockImplementation((items) => items);

    // Mock initial data: one pending item, no playing items
    getQueueSpy.mockResolvedValue({
      data: [{ id: 'track1', status: 'pending' } as any],
      error: null
    });

    getVotesSpy.mockResolvedValue({ data: {}, error: null });
    
    // Slow bootstrap
    const bootstrapPromise = new Promise(() => {});
    bootstrapSpy.mockReturnValue(bootstrapPromise as any);

    const { rerender } = renderHook(() => useQueue(mockRoomCode, mockUserId));

    // Verify first bootstrap attempt
    await waitFor(() => {
      expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    });

    // Force a rerender/reload
    rerender();

    // Verify it didn't call bootstrap again for the same track
    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
  });
});
