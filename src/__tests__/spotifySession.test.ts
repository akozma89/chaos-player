/**
 * Task 1 (RED): Tests for spotifySession.ts
 * - save/load/clear session in localStorage
 * - token expiry detection with 60s buffer
 * - token refresh flow
 * - getValidToken: returns token or null
 */

import {
  saveSession,
  loadSession,
  clearSession,
  isExpired,
  getValidToken,
} from '../lib/spotifySession'

const STORAGE_KEY = 'spotify_session'

// Mock fetch globally for refresh tests
const originalFetch = global.fetch

describe('saveSession', () => {
  beforeEach(() => localStorage.clear())

  it('stores session data in localStorage', () => {
    saveSession({ accessToken: 'tok', refreshToken: 'ref', expiresAt: 9999999999000 })
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.accessToken).toBe('tok')
    expect(parsed.refreshToken).toBe('ref')
  })
})

describe('loadSession', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when nothing is stored', () => {
    expect(loadSession()).toBeNull()
  })

  it('returns parsed session when stored', () => {
    const session = { accessToken: 'a', refreshToken: 'r', expiresAt: 1000000000000 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    const loaded = loadSession()
    expect(loaded).toEqual(session)
  })

  it('returns null and clears storage on corrupt data', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{')
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('clearSession', () => {
  beforeEach(() => localStorage.clear())

  it('removes session from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: 0 }))
    clearSession()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('is a no-op when nothing stored', () => {
    expect(() => clearSession()).not.toThrow()
  })
})

describe('isExpired', () => {
  it('returns false for token expiring far in the future', () => {
    const future = Date.now() + 60 * 60 * 1000 // 1 hour ahead
    expect(isExpired({ accessToken: 'a', refreshToken: 'r', expiresAt: future })).toBe(false)
  })

  it('returns true for already-past expiry', () => {
    const past = Date.now() - 1000
    expect(isExpired({ accessToken: 'a', refreshToken: 'r', expiresAt: past })).toBe(true)
  })

  it('returns true within 60-second buffer before expiry', () => {
    const almostExpired = Date.now() + 30 * 1000 // 30s from now, within 60s buffer
    expect(isExpired({ accessToken: 'a', refreshToken: 'r', expiresAt: almostExpired })).toBe(true)
  })

  it('returns false when more than 60s remain', () => {
    const safeExpiry = Date.now() + 120 * 1000 // 2 minutes from now
    expect(isExpired({ accessToken: 'a', refreshToken: 'r', expiresAt: safeExpiry })).toBe(false)
  })
})

describe('getValidToken', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = originalFetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns null when no session exists', async () => {
    const result = await getValidToken({ clientId: 'cid' })
    expect(result).toBeNull()
  })

  it('returns accessToken when session is valid (not expired)', async () => {
    const session = {
      accessToken: 'valid-token',
      refreshToken: 'ref',
      expiresAt: Date.now() + 60 * 60 * 1000,
    }
    saveSession(session)
    const result = await getValidToken({ clientId: 'cid' })
    expect(result).toBe('valid-token')
  })

  it('refreshes and returns new token when session is expired', async () => {
    const expiredSession = {
      accessToken: 'old-token',
      refreshToken: 'ref-token',
      expiresAt: Date.now() - 1000,
    }
    saveSession(expiredSession)

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-token',
        refresh_token: 'new-ref',
        expires_in: 3600,
      }),
    }) as unknown as typeof fetch

    const result = await getValidToken({ clientId: 'cid' })
    expect(result).toBe('new-token')

    // New session should be persisted
    const stored = loadSession()
    expect(stored?.accessToken).toBe('new-token')
  })

  it('returns null and clears session when refresh fails', async () => {
    const expiredSession = {
      accessToken: 'old-token',
      refreshToken: 'bad-ref',
      expiresAt: Date.now() - 1000,
    }
    saveSession(expiredSession)

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid_grant' }),
    }) as unknown as typeof fetch

    const result = await getValidToken({ clientId: 'cid' })
    expect(result).toBeNull()
    expect(loadSession()).toBeNull()
  })

  it('returns null and clears session when refresh throws network error', async () => {
    const expiredSession = {
      accessToken: 'old-token',
      refreshToken: 'ref',
      expiresAt: Date.now() - 1000,
    }
    saveSession(expiredSession)

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

    const result = await getValidToken({ clientId: 'cid' })
    expect(result).toBeNull()
    expect(loadSession()).toBeNull()
  })
})
