/**
 * Task 4 (RED): Tests for NowPlaying optimistic UI rollback
 * Tests: advance succeeds → onTrackChange called; advance fails → rollback, error shown
 */

import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NowPlaying } from '../components/NowPlaying'
import type { QueueItem } from '../types'

// Mock YoutubePlayer to avoid iframe complexity
jest.mock('../components/YoutubePlayer', () => ({
  YoutubePlayer: ({
    onEnded,
    onSkip,
  }: {
    onEnded?: () => void
    onSkip?: () => void
  }) => (
    <div data-testid="mock-yt-player">
      <button data-testid="trigger-ended" onClick={onEnded}>
        End
      </button>
      <button data-testid="trigger-skip" onClick={onSkip}>
        Skip
      </button>
    </div>
  ),
}))

// Mock advanceQueue and pickNextTrack
jest.mock('../lib/autoAdvance', () => ({
  advanceQueue: jest.fn(),
  pickNextTrack: jest.requireActual('../lib/autoAdvance').pickNextTrack,
}))

const makeTrack = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: 'track-1',
  roomId: 'room-1',
  sourceId: 'abc123',
  source: 'youtube',
  title: 'Test Track',
  artist: 'Test Artist',
  duration: 180,
  addedBy: 'user-1',
  addedAt: '2026-01-01T00:00:00Z',
  position: 0,
  upvotes: 0,
  downvotes: 0,
  status: 'playing',
  playingSince: null,
  ...overrides,
} as QueueItem)

describe('NowPlaying', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows empty state when no track is playing', () => {
    render(<NowPlaying currentTrack={null} queue={[]} isHost={false} userId="user-1" />)
    expect(screen.getByTestId('now-playing-empty')).toBeInTheDocument()
  })

  it('renders track info when a track is playing', () => {
    const track = makeTrack()
    render(<NowPlaying currentTrack={track} queue={[track]} isHost={false} userId="user-1" />)
    expect(screen.getByTestId('now-playing')).toBeInTheDocument()
    expect(screen.getByText('Test Track')).toBeInTheDocument()
    expect(screen.getByText('Test Artist')).toBeInTheDocument()
  })

  it('shows token-skip button for non-host when onTokenSkip provided', () => {
    const track = makeTrack()
    render(
      <NowPlaying
        currentTrack={track}
        queue={[track]}
        isHost={false}
        userId="user-1"
        onTokenSkip={jest.fn()}
      />
    )
    expect(screen.getByTestId('token-skip-btn')).toBeInTheDocument()
  })

  it('calls onTrackChange with next item when advanceQueue succeeds', async () => {
    const { advanceQueue } = require('../lib/autoAdvance')
    const nextTrack = makeTrack({ id: 'track-2', title: 'Next Track' })
    advanceQueue.mockResolvedValueOnce({ nextItem: nextTrack, error: null })

    const onTrackChange = jest.fn()
    const track = makeTrack()
    render(
      <NowPlaying
        currentTrack={track}
        queue={[track, nextTrack]}
        isHost={false}
        userId="user-1"
        onTrackChange={onTrackChange}
      />
    )

    await act(async () => {
      screen.getByTestId('trigger-ended').click()
    })

    await waitFor(() => {
      expect(onTrackChange).toHaveBeenCalledWith(nextTrack)
    })
  })

  it('does NOT call onTrackChange when advanceQueue fails (optimistic rollback)', async () => {
    const { advanceQueue } = require('../lib/autoAdvance')
    advanceQueue.mockResolvedValueOnce({
      nextItem: null,
      error: new Error('Supabase write failed'),
    })

    const onTrackChange = jest.fn()
    const track = makeTrack()
    render(
      <NowPlaying
        currentTrack={track}
        queue={[track]}
        isHost={false}
        userId="user-1"
        onTrackChange={onTrackChange}
      />
    )

    await act(async () => {
      screen.getByTestId('trigger-ended').click()
    })

    // After failure, onTrackChange must NOT be called
    await waitFor(() => {
      expect(onTrackChange).not.toHaveBeenCalled()
    })
  })

  it('shows error message when advanceQueue fails', async () => {
    const { advanceQueue } = require('../lib/autoAdvance')
    advanceQueue.mockResolvedValueOnce({
      nextItem: null,
      error: new Error('Connection refused'),
    })

    const track = makeTrack()
    render(
      <NowPlaying currentTrack={track} queue={[track]} isHost={false} userId="user-1" />
    )

    await act(async () => {
      screen.getByTestId('trigger-ended').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('now-playing-error')).toBeInTheDocument()
    })
  })

  it('host skip also triggers rollback on failure', async () => {
    const { advanceQueue } = require('../lib/autoAdvance')
    advanceQueue.mockResolvedValueOnce({
      nextItem: null,
      error: new Error('DB timeout'),
    })

    const onTrackChange = jest.fn()
    const track = makeTrack()
    render(
      <NowPlaying
        currentTrack={track}
        queue={[track]}
        isHost={true}
        userId="user-1"
        onTrackChange={onTrackChange}
      />
    )

    await act(async () => {
      screen.getByTestId('trigger-skip').click()
    })

    await waitFor(() => {
      expect(onTrackChange).not.toHaveBeenCalled()
      expect(screen.getByTestId('now-playing-error')).toBeInTheDocument()
    })
  })

  it('displays "Next Up" winner and countdown when track is nearing end (<10s)', () => {
    jest.useFakeTimers()
    const currentTrack = makeTrack({ duration: 100 })
    const winner = makeTrack({ id: 'track-winner', title: 'Winning Track', status: 'pending' })
    const queue = [currentTrack, winner]

    render(
      <NowPlaying
        currentTrack={currentTrack}
        queue={queue}
        isHost={false}
        userId="user-1"
      />
    )

    // Advance time to 91 seconds (9 seconds remaining)
    act(() => {
      jest.advanceTimersByTime(91000)
    })

    expect(screen.getByText(/Next Up:/i)).toBeInTheDocument()
    expect(screen.getByText('Winning Track')).toBeInTheDocument()
    expect(screen.getByText(/9s/i)).toBeInTheDocument()

    jest.useRealTimers()
  })
})
