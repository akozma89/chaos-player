/**
 * Client-side Spotify token lifecycle manager.
 * Stores access/refresh tokens in localStorage and handles auto-refresh.
 */

const STORAGE_KEY = 'spotify_session'
const EXPIRY_BUFFER_MS = 60 * 1000 // refresh 60s before actual expiry

export interface SpotifySession {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp in ms
}

// ---------------------------------------------------------------------------
// Storage operations
// ---------------------------------------------------------------------------

export function saveSession(session: SpotifySession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadSession(): SpotifySession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SpotifySession
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// ---------------------------------------------------------------------------
// Expiry check
// ---------------------------------------------------------------------------

export function isExpired(session: SpotifySession): boolean {
  return session.expiresAt - Date.now() < EXPIRY_BUFFER_MS
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshToken(refreshTokenValue: string, clientId: string): Promise<SpotifySession | null> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
    client_id: clientId,
  })

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await response.json()

    if (!response.ok) return null

    const session: SpotifySession = {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string | undefined) ?? refreshTokenValue,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
    }
    return session
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Main: get a valid token, refreshing if needed
// ---------------------------------------------------------------------------

interface GetValidTokenParams {
  clientId: string
}

export async function getValidToken({ clientId }: GetValidTokenParams): Promise<string | null> {
  const session = loadSession()
  if (!session) return null

  if (!isExpired(session)) {
    return session.accessToken
  }

  // Token expired — attempt refresh
  const refreshed = await refreshToken(session.refreshToken, clientId)
  if (!refreshed) {
    clearSession()
    return null
  }

  saveSession(refreshed)
  return refreshed.accessToken
}
