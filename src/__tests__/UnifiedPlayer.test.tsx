import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UnifiedPlayer } from '../components/UnifiedPlayer'
import type { QueueItem, Room } from '../types'

jest.mock('../lib/youtubeIframe', () => ({
  loadYouTubeIframeAPI: jest.fn(() => Promise.resolve()),
  YT_STATES: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
}))

jest.mock('../lib/autoAdvance', () => ({
  advanceQueue: jest.fn(() => Promise.resolve({ nextItem: null, error: null })),
  pickNextTrack: jest.fn(() => null),
}))

jest.mock('../lib/queue', () => ({
  toggleRoomPause: jest.fn(() => Promise.resolve({ error: null })),
}))

jest.mock('../components/YoutubePlayer', () => ({
  YoutubePlayer: ({ volume }: { volume?: number }) => (
    <div data-testid="mock-yt-player" data-volume={volume} />
  ),
}))

jest.mock('../components/ChaosSyncOverlay', () => ({
  __esModule: true,
  default: () => null,
}))

const mockTrack: QueueItem = {
  id: 'track-1',
  roomId: 'room-1',
  sourceId: 'yt-abc',
  source: 'youtube',
  title: 'Test Song',
  artist: 'Test Artist',
  duration: 240,
  addedBy: 'user-1',
  addedByName: 'Alice',
  addedAt: new Date().toISOString(),
  position: 1,
  upvotes: 2,
  downvotes: 0,
  status: 'playing',
  playingSince: new Date(Date.now() - 10_000).toISOString(),
}

const mockRoom: Room = {
  id: 'room-1',
  name: 'Test Room',
  code: 'ABCD12',
  hostId: 'host-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isActive: true,
  isPublic: true,
  isPaused: false,
  pausedAt: null,
}

const baseProps = {
  currentTrack: mockTrack,
  queue: [mockTrack],
  room: mockRoom,
  isHost: true,
  userId: 'host-1',
}

describe('UnifiedPlayer – volume control', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the volume slider and mute button', () => {
    render(<UnifiedPlayer {...baseProps} />)
    expect(screen.getByTestId('volume-slider')).toBeInTheDocument()
    expect(screen.getByTestId('mute-btn')).toBeInTheDocument()
  })

  it('restores volume from localStorage on mount', () => {
    localStorage.setItem('chaos-player-volume', '42')
    render(<UnifiedPlayer {...baseProps} />)
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement
    expect(slider.value).toBe('42')
  })

  it('defaults to volume 100 when localStorage is empty', () => {
    render(<UnifiedPlayer {...baseProps} />)
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement
    expect(slider.value).toBe('100')
  })

  it('passes volume to YoutubePlayer', () => {
    localStorage.setItem('chaos-player-volume', '60')
    render(<UnifiedPlayer {...baseProps} />)
    expect(screen.getByTestId('mock-yt-player')).toHaveAttribute('data-volume', '60')
  })

  it('updates volume when slider changes and persists to localStorage', () => {
    render(<UnifiedPlayer {...baseProps} />)
    const slider = screen.getByTestId('volume-slider')
    fireEvent.change(slider, { target: { value: '75' } })
    expect((slider as HTMLInputElement).value).toBe('75')
    expect(localStorage.getItem('chaos-player-volume')).toBe('75')
  })

  it('mutes (sets volume to 0) when mute button clicked', () => {
    render(<UnifiedPlayer {...baseProps} />)
    const muteBtn = screen.getByTestId('mute-btn')
    fireEvent.click(muteBtn)
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement
    expect(slider.value).toBe('0')
    expect(localStorage.getItem('chaos-player-volume')).toBe('0')
  })

  it('restores previous volume when unmuting', () => {
    render(<UnifiedPlayer {...baseProps} />)
    const slider = screen.getByTestId('volume-slider')
    // Set a specific volume first
    fireEvent.change(slider, { target: { value: '65' } })
    // Mute
    fireEvent.click(screen.getByTestId('mute-btn'))
    expect((slider as HTMLInputElement).value).toBe('0')
    // Unmute
    fireEvent.click(screen.getByTestId('mute-btn'))
    expect((slider as HTMLInputElement).value).toBe('65')
    expect(localStorage.getItem('chaos-player-volume')).toBe('65')
  })

  it('shows waiting state when no track is playing', () => {
    render(<UnifiedPlayer {...baseProps} currentTrack={null} />)
    expect(screen.getByText(/Waiting for democracy/i)).toBeInTheDocument()
    expect(screen.queryByTestId('volume-slider')).not.toBeInTheDocument()
  })
})
