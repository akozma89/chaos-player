/**
 * Tests for ConnectSpotify component
 * - Renders connect button
 * - Initiates PKCE flow on click (stores verifier, redirects)
 * - Shows connected state when token present
 * - Disconnect clears session
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConnectSpotify from '../components/ConnectSpotify'

// Mock spotifySession
jest.mock('../lib/spotifySession', () => ({
  loadSession: jest.fn(),
  clearSession: jest.fn(),
  saveSession: jest.fn(),
}))

// Mock spotify lib
jest.mock('../lib/spotify', () => ({
  generateCodeVerifier: jest.fn().mockReturnValue('test-verifier-123'),
  generateCodeChallenge: jest.fn().mockResolvedValue('test-challenge-abc'),
  buildSpotifyAuthUrl: jest.fn().mockReturnValue('https://accounts.spotify.com/authorize?test'),
}))

const { loadSession, clearSession } = require('../lib/spotifySession')

describe('ConnectSpotify', () => {
  const mockOnConnected = jest.fn()
  const mockOnDisconnected = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    loadSession.mockReturnValue(null)
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    })
    // Mock window.location.assign
    delete (window as unknown as Record<string, unknown>).location
    ;(window as unknown as Record<string, unknown>).location = { assign: jest.fn(), href: '' }
  })

  it('renders "Connect Spotify" button when not connected', () => {
    render(<ConnectSpotify clientId="cid" onConnected={mockOnConnected} onDisconnected={mockOnDisconnected} />)
    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeInTheDocument()
  })

  it('renders "Disconnect" button when session is active', () => {
    loadSession.mockReturnValue({ accessToken: 'tok', refreshToken: 'ref', expiresAt: Date.now() + 3600000 })
    render(<ConnectSpotify clientId="cid" onConnected={mockOnConnected} onDisconnected={mockOnDisconnected} />)
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
  })

  it('stores code verifier in sessionStorage on connect click', async () => {
    render(<ConnectSpotify clientId="cid" redirectUri="http://localhost/callback" onConnected={mockOnConnected} onDisconnected={mockOnDisconnected} />)
    const btn = screen.getByRole('button', { name: /connect spotify/i })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('spotify_pkce_verifier', 'test-verifier-123')
    })
  })

  it('calls buildSpotifyAuthUrl with clientId on connect click', async () => {
    const { buildSpotifyAuthUrl } = require('../lib/spotify')
    render(<ConnectSpotify clientId="test-client-id" redirectUri="http://localhost/callback" onConnected={mockOnConnected} onDisconnected={mockOnDisconnected} />)
    const btn = screen.getByRole('button', { name: /connect spotify/i })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(buildSpotifyAuthUrl).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 'test-client-id',
      }))
    })
  })

  it('calls onDisconnected and clears session on disconnect click', () => {
    loadSession.mockReturnValue({ accessToken: 'tok', refreshToken: 'ref', expiresAt: Date.now() + 3600000 })
    render(<ConnectSpotify clientId="cid" onConnected={mockOnConnected} onDisconnected={mockOnDisconnected} />)
    const btn = screen.getByRole('button', { name: /disconnect/i })
    fireEvent.click(btn)
    expect(clearSession).toHaveBeenCalled()
    expect(mockOnDisconnected).toHaveBeenCalled()
  })
})
