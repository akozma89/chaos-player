/**
 * Task 1 (RED): Tests for YouTube search service
 * Tests: search query, debounce, error handling, result shape
 */

import { searchYouTube, parseYouTubeDuration, type YouTubeSearchResult } from '../lib/youtube'

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('parseYouTubeDuration', () => {
  it('should parse ISO 8601 duration PT3M45S to seconds', () => {
    expect(parseYouTubeDuration('PT3M45S')).toBe(225)
  })

  it('should parse PT1H2M3S', () => {
    expect(parseYouTubeDuration('PT1H2M3S')).toBe(3723)
  })

  it('should parse PT30S', () => {
    expect(parseYouTubeDuration('PT30S')).toBe(30)
  })

  it('should return 0 for empty string', () => {
    expect(parseYouTubeDuration('')).toBe(0)
  })
})

describe('searchYouTube', () => {
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

  const MOCK_VIDEOS_RESPONSE = {
    items: [
      {
        id: 'abc123',
        contentDetails: { duration: 'PT3M45S' },
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_YOUTUBE_API_KEY = 'test-api-key'
  })

  it('should search YouTube and return typed results', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_VIDEOS_RESPONSE,
      })

    const results = await searchYouTube('test query')

    expect(results).toHaveLength(1)
    const result: YouTubeSearchResult = results[0]
    expect(result.sourceId).toBe('abc123')
    expect(result.title).toBe('Test Song')
    expect(result.channelTitle).toBe('Test Artist')
    expect(result.duration).toBe(225)
    expect(result.thumbnailUrl).toBe('https://img.youtube.com/abc123')
  })

  it('should call YouTube search API with correct query and key', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_SEARCH_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_VIDEOS_RESPONSE })

    await searchYouTube('bohemian rhapsody')

    const searchUrl = mockFetch.mock.calls[0][0] as string
    expect(searchUrl).toContain('youtube.googleapis.com')
    expect(searchUrl).toContain('bohemian+rhapsody')
    expect(searchUrl).toContain('test-api-key')
  })

  it('should return empty array on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })

    const results = await searchYouTube('test')

    expect(results).toEqual([])
  })

  it('should return empty array when query is blank', async () => {
    const results = await searchYouTube('   ')
    expect(results).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const results = await searchYouTube('test')

    expect(results).toEqual([])
  })
})
