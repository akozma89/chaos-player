import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock the SDK loader
jest.mock('../lib/spotifyPlayer', () => ({
  loadSpotifySDK: jest.fn(() => Promise.resolve()),
}))

// Mock spotifySession token retrieval
jest.mock('../lib/spotifySession', () => ({
  getValidToken: jest.fn(() => Promise.resolve('mock-token')),
}))

import { SpotifyPlayer } from '../components/SpotifyPlayer'
import { getValidToken } from '../lib/spotifySession'

// Mock fetch for Spotify Web API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

const mockPlayer = {
  connect: jest.fn(() => Promise.resolve(true)),
  disconnect: jest.fn(),
  pause: jest.fn(() => Promise.resolve()),
  resume: jest.fn(() => Promise.resolve()),
  togglePlay: jest.fn(() => Promise.resolve()),
  seek: jest.fn(() => Promise.resolve()),
  setVolume: jest.fn(() => Promise.resolve()),
  getCurrentState: jest.fn(() => Promise.resolve(null)),
  addListener: jest.fn(),
  removeListener: jest.fn(),
}

let readyCallback: ((data: { device_id: string }) => void) | null = null
let stateChangeCallback: ((state: any) => void) | null = null
let notReadyCallback: ((data: { device_id: string }) => void) | null = null

beforeEach(() => {
  jest.clearAllMocks()
  readyCallback = null
  stateChangeCallback = null
  notReadyCallback = null

  mockFetch.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) })

  mockPlayer.addListener.mockImplementation((event: string, cb: any) => {
    if (event === 'ready') readyCallback = cb
    if (event === 'player_state_changed') stateChangeCallback = cb
    if (event === 'not_ready') notReadyCallback = cb
  })

  window.Spotify = {
    Player: jest.fn().mockImplementation(() => {
      // Fire ready callback async so playerRef is assigned first
      setTimeout(() => {
        act(() => {
          readyCallback?.({ device_id: 'device-abc' })
        })
      }, 0)
      return mockPlayer
    }),
  } as unknown as typeof window.Spotify
})

const baseProps = {
  trackId: 'spotify-track-123',
  playingSince: null,
}

describe('SpotifyPlayer', () => {
  it('renders the player container', () => {
    render(<SpotifyPlayer {...baseProps} />)
    expect(screen.getByTestId('spotify-player-container')).toBeInTheDocument()
  })

  it('shows connecting state before ready', () => {
    // Prevent ready from firing by not including it in addListener
    window.Spotify = {
      Player: jest.fn().mockImplementation(() => mockPlayer),
    } as unknown as typeof window.Spotify

    render(<SpotifyPlayer {...baseProps} />)
    expect(screen.getByText(/Connecting to Spotify/i)).toBeInTheDocument()
  })

  it('calls the Spotify play API with correct track URI when device is ready', async () => {
    render(<SpotifyPlayer {...baseProps} />)

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/player/play'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('spotify:track:spotify-track-123'),
        })
      )
    )
  })

  it('includes correct position_ms when playingSince is set', async () => {
    const playingSince = new Date(Date.now() - 30_000).toISOString()
    render(<SpotifyPlayer {...baseProps} playingSince={playingSince} />)

    await waitFor(() => {
      const call = mockFetch.mock.calls.find((c) => c[0].includes('/me/player/play'))
      expect(call).toBeDefined()
      const body = JSON.parse(call![1].body)
      expect(body.position_ms).toBeGreaterThan(28_000)
      expect(body.position_ms).toBeLessThan(32_000)
    })
  })

  it('calls player.pause() immediately after start when isPaused=true', async () => {
    jest.useFakeTimers()

    render(<SpotifyPlayer {...baseProps} isPaused={true} />)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/me/player/play'), expect.anything()))

    // Advance timer for the 300ms delay before initial pause
    act(() => jest.advanceTimersByTime(400))

    await waitFor(() => expect(mockPlayer.pause).toHaveBeenCalled())

    jest.useRealTimers()
  })

  it('calls player.pause() when isPaused prop changes to true after ready', async () => {
    const { rerender } = render(<SpotifyPlayer {...baseProps} isPaused={false} />)

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    // Wait for isReady to be set
    await waitFor(() => expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument())

    rerender(<SpotifyPlayer {...baseProps} isPaused={true} />)

    await waitFor(() => expect(mockPlayer.pause).toHaveBeenCalled())
  })

  it('calls player.resume() when isPaused changes to false after ready', async () => {
    const { rerender } = render(<SpotifyPlayer {...baseProps} isPaused={true} />)

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    rerender(<SpotifyPlayer {...baseProps} isPaused={false} />)

    await waitFor(() => expect(mockPlayer.resume).toHaveBeenCalled())
  })

  it('sets initial volume on the player', async () => {
    render(<SpotifyPlayer {...baseProps} volume={60} />)

    // Initial volume is passed to SDK constructor
    await waitFor(() => expect(window.Spotify.Player).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 0.6 })
    ))
  })

  it('calls setVolume when volume prop changes after ready', async () => {
    const { rerender } = render(<SpotifyPlayer {...baseProps} volume={100} />)

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument())

    rerender(<SpotifyPlayer {...baseProps} volume={40} />)

    await waitFor(() => expect(mockPlayer.setVolume).toHaveBeenCalledWith(0.4))
  })

  it('calls onEnded when player_state_changed signals track end', async () => {
    const onEnded = jest.fn()
    render(<SpotifyPlayer {...baseProps} trackId="end-track" onEnded={onEnded} />)

    await waitFor(() => expect(stateChangeCallback).toBeDefined())

    act(() => {
      stateChangeCallback!({
        paused: true,
        position: 0,
        duration: 200000,
        track_window: {
          current_track: { id: 'end-track', name: 'T', duration_ms: 200000, artists: [], album: { images: [] } },
          previous_tracks: [{ id: 'end-track', name: 'T', duration_ms: 200000, artists: [], album: { images: [] } }],
          next_tracks: [],
        },
      })
    })

    await waitFor(() => expect(onEnded).toHaveBeenCalled())
  })

  it('does NOT call onEnded when state changes but previous_tracks does not contain current track', async () => {
    const onEnded = jest.fn()
    render(<SpotifyPlayer {...baseProps} trackId="my-track" onEnded={onEnded} />)

    await waitFor(() => expect(stateChangeCallback).toBeDefined())

    act(() => {
      stateChangeCallback!({
        paused: true,
        position: 0,
        duration: 200000,
        track_window: {
          current_track: { id: 'my-track', name: 'T', duration_ms: 200000, artists: [], album: { images: [] } },
          previous_tracks: [],
          next_tracks: [],
        },
      })
    })

    expect(onEnded).not.toHaveBeenCalled()
  })

  it('seeks when playingSince changes and drift exceeds 2s', async () => {
    const playingSince = new Date(Date.now() - 30_000).toISOString()

    mockPlayer.getCurrentState.mockResolvedValue({
      paused: false,
      position: 0, // big drift vs 30s
      duration: 200000,
      track_window: { current_track: { id: 'spotify-track-123' }, previous_tracks: [], next_tracks: [] },
    })

    render(<SpotifyPlayer {...baseProps} playingSince={playingSince} isPaused={false} />)

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument())
    await waitFor(() => expect(mockPlayer.seek).toHaveBeenCalledWith(expect.any(Number)))
  })

  it('disconnects player on unmount', async () => {
    const { unmount } = render(<SpotifyPlayer {...baseProps} />)

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    unmount()

    expect(mockPlayer.disconnect).toHaveBeenCalled()
  })

  it('fetches token via getValidToken for API calls', async () => {
    render(<SpotifyPlayer {...baseProps} />)

    await waitFor(() => expect(getValidToken).toHaveBeenCalled())
  })

  it('shows error message when account_error fires', async () => {
    let errorCallback: ((data: { message: string }) => void) | null = null
    mockPlayer.addListener.mockImplementation((event: string, cb: any) => {
      if (event === 'ready') readyCallback = cb
      if (event === 'account_error') errorCallback = cb
    })

    render(<SpotifyPlayer {...baseProps} />)

    await waitFor(() => expect(errorCallback).toBeDefined())

    act(() => {
      errorCallback!({ message: 'Premium required' })
    })

    await waitFor(() =>
      expect(screen.getByText(/Premium required/i)).toBeInTheDocument()
    )
  })
})
