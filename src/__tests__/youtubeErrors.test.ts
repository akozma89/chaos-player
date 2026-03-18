/**
 * Task 2 (RED): Tests for YouTube API error paths
 * Tests: 403 quota, network failure, invalid videoId handling
 * These tests FAIL until searchYouTubeWithErrors is implemented in youtube.ts
 */

import { searchYouTubeWithErrors } from '../lib/youtube'

const mockFetch = jest.fn()
global.fetch = mockFetch

const MOCK_SEARCH_RESPONSE = {
  items: [
    {
      id: { videoId: 'abc123' },
      snippet: {
        title: 'Test Song',
        channelTitle: 'Test Artist',
        thumbnails: { medium: { url: 'https://img.youtube.com/abc123' } },
      },
    },
  ],
}

describe('YouTube API error paths (searchYouTubeWithErrors)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_YOUTUBE_API_KEY = 'test-api-key'
  })

  it('returns quota_exceeded error on 403 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: 403, errors: [{ reason: 'quotaExceeded' }] },
      }),
    })

    const { results, error } = await searchYouTubeWithErrors('test')

    expect(results).toEqual([])
    expect(error).not.toBeNull()
    expect(error?.type).toBe('quota_exceeded')
    expect(error?.message).toBeTruthy()
  })

  it('returns network_error on fetch rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    const { results, error } = await searchYouTubeWithErrors('test')

    expect(results).toEqual([])
    expect(error).not.toBeNull()
    expect(error?.type).toBe('network_error')
  })

  it('returns api_error on non-403 HTTP error status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 500, message: 'Internal Server Error' } }),
    })

    const { results, error } = await searchYouTubeWithErrors('test')

    expect(results).toEqual([])
    expect(error).not.toBeNull()
    expect(error?.type).toBe('api_error')
  })

  it('returns results with duration=0 when videoId not found in contentDetails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_SEARCH_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) }) // empty contentDetails

    const { results, error } = await searchYouTubeWithErrors('test')

    expect(error).toBeNull()
    expect(results).toHaveLength(1)
    expect(results[0].duration).toBe(0)
    expect(results[0].videoId).toBe('abc123')
  })

  it('returns empty results with no error for blank query (no network call)', async () => {
    const { results, error } = await searchYouTubeWithErrors('   ')

    expect(results).toEqual([])
    expect(error).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns results normally on successful search', async () => {
    const MOCK_VIDEOS_RESPONSE = {
      items: [{ id: 'abc123', contentDetails: { duration: 'PT3M45S' } }],
    }

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_SEARCH_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_VIDEOS_RESPONSE })

    const { results, error } = await searchYouTubeWithErrors('test')

    expect(error).toBeNull()
    expect(results).toHaveLength(1)
    expect(results[0].videoId).toBe('abc123')
    expect(results[0].duration).toBe(225)
  })
})
