/**
 * Spotify OAuth PKCE flow + search API
 * Source-agnostic search results compatible with YouTube search results
 */

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

const PKCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
const VERIFIER_LENGTH = 128

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

export function generateCodeVerifier(): string {
  const array = new Uint8Array(VERIFIER_LENGTH)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => PKCE_CHARS[b % PKCE_CHARS.length])
    .join('')
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  // Use Web Crypto if available (browser/edge), fall back to Node.js crypto
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return base64UrlEncode(new Uint8Array(digest))
  }

  // Node.js fallback (test environment)
  const nodeCrypto = await import('crypto')
  const hash = nodeCrypto.createHash('sha256').update(verifier).digest()
  return base64UrlEncode(new Uint8Array(hash))
}

function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ---------------------------------------------------------------------------
// Auth URL builder
// ---------------------------------------------------------------------------

interface BuildAuthUrlParams {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string
}

export function buildSpotifyAuthUrl({
  clientId,
  redirectUri,
  codeChallenge,
  state,
}: BuildAuthUrlParams): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    scope: 'user-read-private streaming user-read-email',
  })
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

interface ExchangeParams {
  code: string
  codeVerifier: string
  clientId: string
  redirectUri: string
}

export interface TokenResult {
  accessToken: string | null
  refreshToken: string | null
  expiresIn: number | null
  error: Error | null
}

export async function exchangeCodeForTokens({
  code,
  codeVerifier,
  clientId,
  redirectUri,
}: ExchangeParams): Promise<TokenResult> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  })

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        accessToken: null,
        refreshToken: null,
        expiresIn: null,
        error: new Error(data.error ?? 'Token exchange failed'),
      }
    }

    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresIn: data.expires_in as number,
      error: null,
    }
  } catch (err) {
    return {
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    }
  }
}

// ---------------------------------------------------------------------------
// Source-agnostic search result type
// ---------------------------------------------------------------------------

export interface SourceSearchResult {
  sourceId: string
  source: 'youtube' | 'spotify'
  title: string
  artist: string
  duration: number // seconds
  thumbnailUrl: string
}

export interface SearchResults {
  items: SourceSearchResult[]
  error?: Error | null
}

// ---------------------------------------------------------------------------
// Spotify search
// ---------------------------------------------------------------------------

interface SearchParams {
  query: string
  accessToken: string
  limit?: number
}

export async function searchSpotify({
  query,
  accessToken,
  limit = 10,
}: SearchParams): Promise<SearchResults> {
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(limit),
  })

  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return { items: [], error: new Error('Spotify search failed') }
    }

    const data = await response.json()
    const tracks = data.tracks?.items ?? []

    const items: SourceSearchResult[] = tracks.map((track: Record<string, unknown>) => {
      const artists = (track.artists as Array<{ name: string }>) ?? []
      const album = track.album as Record<string, unknown>
      const images = (album?.images as Array<{ url: string }>) ?? []

      return {
        sourceId: track.id as string,
        source: 'spotify' as const,
        title: track.name as string,
        artist: artists.map((a) => a.name).join(', '),
        duration: Math.round((track.duration_ms as number) / 1000),
        thumbnailUrl: images[0]?.url ?? '',
      }
    })

    return { items, error: null }
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    }
  }
}
