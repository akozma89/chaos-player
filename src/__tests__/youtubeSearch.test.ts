import { searchYouTube, searchYouTubeWithErrors, parseYouTubeDuration } from '../lib/youtube'

const mockFetch = jest.fn()
global.fetch = mockFetch

const SEARCH_ITEMS = [
  {
    id: { videoId: 'video1' },
    snippet: {
      title: 'Video 1',
      channelTitle: 'Channel 1',
      thumbnails: { medium: { url: 'https://img.youtube.com/vi/video1/mqdefault.jpg' } },
    },
  },
  {
    id: { videoId: 'video2' },
    snippet: {
      title: 'Video 2',
      channelTitle: 'Channel 2',
      thumbnails: { medium: { url: 'https://img.youtube.com/vi/video2/mqdefault.jpg' } },
    },
  },
]

const VIDEO_DETAILS = [
  { id: 'video1', contentDetails: { duration: 'PT3M30S' } },
  { id: 'video2', contentDetails: { duration: 'PT1H2M3S' } },
]

function mockSearchAndVideos() {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: SEARCH_ITEMS }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: VIDEO_DETAILS }),
    })
}

describe('parseYouTubeDuration', () => {
  it('parses seconds only', () => {
    expect(parseYouTubeDuration('PT45S')).toBe(45)
  })

  it('parses minutes and seconds', () => {
    expect(parseYouTubeDuration('PT3M30S')).toBe(210)
  })

  it('parses hours, minutes and seconds', () => {
    expect(parseYouTubeDuration('PT1H2M3S')).toBe(3723)
  })

  it('returns 0 for empty string', () => {
    expect(parseYouTubeDuration('')).toBe(0)
  })

  it('returns 0 for invalid string', () => {
    expect(parseYouTubeDuration('invalid')).toBe(0)
  })
})

describe('searchYouTube', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns mapped results with durations', async () => {
    mockSearchAndVideos()

    const results = await searchYouTube('test query')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      sourceId: 'video1',
      title: 'Video 1',
      channelTitle: 'Channel 1',
      thumbnailUrl: 'https://img.youtube.com/vi/video1/mqdefault.jpg',
      duration: 210,
    })
    expect(results[1]).toEqual({
      sourceId: 'video2',
      title: 'Video 2',
      channelTitle: 'Channel 2',
      thumbnailUrl: 'https://img.youtube.com/vi/video2/mqdefault.jpg',
      duration: 3723,
    })
  })

  it('returns empty array for blank query', async () => {
    const results = await searchYouTube('   ')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(results).toEqual([])
  })

  it('returns empty array when search API returns no items', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    })

    const results = await searchYouTube('test')
    expect(results).toEqual([])
  })

  it('returns empty array when fetch rejects (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'))

    const results = await searchYouTube('test')
    expect(results).toEqual([])
  })

  it('returns empty array when search API responds with non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const results = await searchYouTube('test')
    expect(results).toEqual([])
  })

  it('falls back to 0 duration when videos endpoint fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [SEARCH_ITEMS[0]] }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 })

    const results = await searchYouTube('test')
    expect(results[0].duration).toBe(0)
  })
})

describe('searchYouTubeWithErrors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns results with no error on success', async () => {
    mockSearchAndVideos()

    const response = await searchYouTubeWithErrors('test query')

    expect(response.error).toBeNull()
    expect(response.results).toHaveLength(2)
    expect(response.results[0].sourceId).toBe('video1')
  })

  it('returns empty results with no error for blank query', async () => {
    const response = await searchYouTubeWithErrors('  ')
    expect(response.results).toEqual([])
    expect(response.error).toBeNull()
  })

  it('returns quota_exceeded error on 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'quota exceeded' } }),
    })

    const response = await searchYouTubeWithErrors('test')
    expect(response.error?.type).toBe('quota_exceeded')
    expect(response.results).toEqual([])
  })

  it('returns api_error on non-403 failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'internal error' } }),
    })

    const response = await searchYouTubeWithErrors('test')
    expect(response.error?.type).toBe('api_error')
  })

  it('returns network_error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'))

    const response = await searchYouTubeWithErrors('test')
    expect(response.error?.type).toBe('network_error')
    expect(response.results).toEqual([])
  })
})
