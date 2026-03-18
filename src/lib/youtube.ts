/**
 * YouTube Data API v3 search service
 * Searches for videos and fetches duration via contentDetails
 */

export type YouTubeErrorType = 'quota_exceeded' | 'network_error' | 'api_error'

export interface YouTubeError {
  type: YouTubeErrorType
  message: string
}

export interface YouTubeSearchResponse {
  results: YouTubeSearchResult[]
  error: YouTubeError | null
}

export interface YouTubeSearchResult {
  sourceId: string
  title: string
  channelTitle: string
  duration: number // seconds
  thumbnailUrl: string
}

/** Parse ISO 8601 duration (e.g. PT1H2M3S) to seconds */
export function parseYouTubeDuration(iso: string): number {
  if (!iso) return 0
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] ?? '0', 10)
  const m = parseInt(match[2] ?? '0', 10)
  const s = parseInt(match[3] ?? '0', 10)
  return h * 3600 + m * 60 + s
}

export async function searchYouTubeWithErrors(query: string): Promise<YouTubeSearchResponse> {
  if (!query.trim()) return { results: [], error: null }

  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
  const encodedQuery = encodeURIComponent(query.trim()).replace(/%20/g, '+')

  const searchUrl =
    `https://youtube.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=10&q=${encodedQuery}&key=${apiKey}`

  try {
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) {
      const errorData = await searchRes.json().catch(() => ({}))
      return {
        results: [],
        error: {
          type: searchRes.status === 403 ? 'quota_exceeded' : 'api_error',
          message: errorData?.error?.message ?? `HTTP ${searchRes.status}`,
        },
      }
    }

    const searchData = await searchRes.json()
    const items: Array<{
      id: { videoId: string }
      snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } }
    }> = searchData.items ?? []

    if (items.length === 0) return { results: [], error: null }

    const ids = items.map((i) => i.id.videoId).join(',')
    const videosUrl =
      `https://youtube.googleapis.com/youtube/v3/videos` +
      `?part=contentDetails&id=${ids}&key=${apiKey}`

    const videosRes = await fetch(videosUrl)
    const videosData = videosRes.ok ? await videosRes.json() : { items: [] }
    const durMap: Record<string, number> = {}
    for (const v of videosData.items ?? []) {
      durMap[v.id] = parseYouTubeDuration(v.contentDetails?.duration ?? '')
    }

    const results = items.map((item) => ({
      sourceId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? '',
      duration: durMap[item.id.videoId] ?? 0,
    }))

    return { results, error: null }
  } catch {
    return {
      results: [],
      error: { type: 'network_error', message: 'Network request failed' },
    }
  }
}

export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  if (!query.trim()) return []

  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
  const encodedQuery = encodeURIComponent(query.trim()).replace(/%20/g, '+')

  const searchUrl =
    `https://youtube.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=10&q=${encodedQuery}&key=${apiKey}`

  try {
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) return []

    const searchData = await searchRes.json()
    const items: Array<{ id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } } }> =
      searchData.items ?? []

    if (items.length === 0) return []

    // Fetch durations in a single batch request
    const ids = items.map((i) => i.id.videoId).join(',')
    const videosUrl =
      `https://youtube.googleapis.com/youtube/v3/videos` +
      `?part=contentDetails&id=${ids}&key=${apiKey}`

    const videosRes = await fetch(videosUrl)
    const videosData = videosRes.ok ? await videosRes.json() : { items: [] }
    const durMap: Record<string, number> = {}
    for (const v of videosData.items ?? []) {
      durMap[v.id] = parseYouTubeDuration(v.contentDetails?.duration ?? '')
    }

    return items.map((item) => ({
      sourceId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? '',
      duration: durMap[item.id.videoId] ?? 0,
    }))
  } catch {
    return []
  }
}
