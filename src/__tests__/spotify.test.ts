/**
 * Task 4 (RED): Tests for Spotify OAuth PKCE flow + search API
 * - PKCE code verifier/challenge generation
 * - Auth URL construction
 * - Code exchange for tokens
 * - Spotify search returning source-agnostic results
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildSpotifyAuthUrl,
  exchangeCodeForTokens,
  searchSpotify,
} from '../lib/spotify'
import type { SourceSearchResult } from '../lib/spotify'

// Store original fetch
const originalFetch = global.fetch

describe('generateCodeVerifier', () => {
  it('returns a string of length 128 characters', () => {
    const verifier = generateCodeVerifier()
    expect(typeof verifier).toBe('string')
    expect(verifier.length).toBe(128)
  })

  it('contains only URL-safe characters', () => {
    const verifier = generateCodeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('is unique each call', () => {
    const v1 = generateCodeVerifier()
    const v2 = generateCodeVerifier()
    expect(v1).not.toBe(v2)
  })
})

describe('generateCodeChallenge', () => {
  it('returns a non-empty string', async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    expect(typeof challenge).toBe('string')
    expect(challenge.length).toBeGreaterThan(0)
  })

  it('returns a base64url encoded string (no +, /, = chars)', async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    // base64url must not contain +, /, or =
    expect(challenge).not.toMatch(/[+/=]/)
  })

  it('is deterministic for same input', async () => {
    const verifier = 'test-verifier-abc123'
    const c1 = await generateCodeChallenge(verifier)
    const c2 = await generateCodeChallenge(verifier)
    expect(c1).toBe(c2)
  })
})

describe('buildSpotifyAuthUrl', () => {
  it('returns a valid URL string', () => {
    const url = buildSpotifyAuthUrl({
      clientId: 'client123',
      redirectUri: 'http://localhost:3000/callback',
      codeChallenge: 'challenge-abc',
      state: 'state-xyz',
    })
    expect(() => new URL(url)).not.toThrow()
  })

  it('points to Spotify authorization endpoint', () => {
    const url = buildSpotifyAuthUrl({
      clientId: 'client123',
      redirectUri: 'http://localhost:3000/callback',
      codeChallenge: 'challenge-abc',
      state: 'state-xyz',
    })
    expect(url).toContain('accounts.spotify.com')
    expect(url).toContain('/authorize')
  })

  it('includes required OAuth2 params', () => {
    const url = buildSpotifyAuthUrl({
      clientId: 'client123',
      redirectUri: 'http://localhost:3000/callback',
      codeChallenge: 'challenge-abc',
      state: 'state-xyz',
    })
    const parsed = new URL(url)
    expect(parsed.searchParams.get('client_id')).toBe('client123')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback')
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-abc')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('state')).toBe('state-xyz')
  })

  it('requests search scope', () => {
    const url = buildSpotifyAuthUrl({
      clientId: 'client123',
      redirectUri: 'http://localhost:3000/callback',
      codeChallenge: 'challenge-abc',
      state: 'state-xyz',
    })
    const parsed = new URL(url)
    const scope = parsed.searchParams.get('scope') ?? ''
    expect(scope).toContain('user-read-private')
  })
})

describe('exchangeCodeForTokens', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('exchanges code for access_token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    }) as unknown as typeof fetch

    const result = await exchangeCodeForTokens({
      code: 'auth-code-abc',
      codeVerifier: 'verifier-xyz',
      clientId: 'client123',
      redirectUri: 'http://localhost:3000/callback',
    })

    expect(result.accessToken).toBe('access-123')
    expect(result.refreshToken).toBe('refresh-456')
    expect(result.expiresIn).toBe(3600)
    expect(result.error).toBeNull()
  })

  it('posts to Spotify token endpoint', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    }) as unknown as typeof fetch
    global.fetch = mockFetch

    await exchangeCodeForTokens({
      code: 'code',
      codeVerifier: 'verifier',
      clientId: 'cid',
      redirectUri: 'http://localhost/cb',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://accounts.spotify.com/api/token',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns error on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid_grant' }),
    }) as unknown as typeof fetch

    const result = await exchangeCodeForTokens({
      code: 'bad-code',
      codeVerifier: 'verifier',
      clientId: 'cid',
      redirectUri: 'http://localhost/cb',
    })

    expect(result.error).toBeTruthy()
    expect(result.accessToken).toBeNull()
  })
})

describe('searchSpotify', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns array of SourceSearchResult', async () => {
    const mockTracks = {
      tracks: {
        items: [
          {
            id: 'spotify:track:123',
            name: 'Test Song',
            artists: [{ name: 'Test Artist' }],
            album: { images: [{ url: 'https://img.example.com/cover.jpg' }] },
            duration_ms: 240000,
            uri: 'spotify:track:123',
          },
        ],
      },
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTracks,
    }) as unknown as typeof fetch

    const results = await searchSpotify({ query: 'Test Song', accessToken: 'tok-abc' })

    expect(Array.isArray(results.items)).toBe(true)
    expect(results.items).toHaveLength(1)
  })

  it('maps Spotify track to SourceSearchResult shape', async () => {
    const mockTracks = {
      tracks: {
        items: [
          {
            id: 'track-id-1',
            name: 'My Song',
            artists: [{ name: 'My Artist' }],
            album: { images: [{ url: 'https://img.example.com/cover.jpg' }] },
            duration_ms: 180000,
            uri: 'spotify:track:track-id-1',
          },
        ],
      },
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTracks,
    }) as unknown as typeof fetch

    const results = await searchSpotify({ query: 'My Song', accessToken: 'tok' })
    const item: SourceSearchResult = results.items[0]

    expect(item.sourceId).toBe('track-id-1')
    expect(item.source).toBe('spotify')
    expect(item.title).toBe('My Song')
    expect(item.artist).toBe('My Artist')
    expect(item.duration).toBe(180)
    expect(item.thumbnailUrl).toBe('https://img.example.com/cover.jpg')
  })

  it('returns empty array on fetch error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

    const results = await searchSpotify({ query: 'anything', accessToken: 'tok' })

    expect(results.items).toEqual([])
    expect(results.error).toBeTruthy()
  })

  it('sends Authorization header with bearer token', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tracks: { items: [] } }),
    }) as unknown as typeof fetch
    global.fetch = mockFetch

    await searchSpotify({ query: 'test', accessToken: 'my-access-token' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.spotify.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-access-token',
        }),
      })
    )
  })

  it('respects limit parameter', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tracks: { items: [] } }),
    }) as unknown as typeof fetch
    global.fetch = mockFetch

    await searchSpotify({ query: 'test', accessToken: 'tok', limit: 5 })

    const calledUrl = (mockFetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('limit=5')
  })
})
