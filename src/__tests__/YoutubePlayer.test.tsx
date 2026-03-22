import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('../lib/youtubeIframe', () => ({
  loadYouTubeIframeAPI: jest.fn(() => Promise.resolve()),
  YT_STATES: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
}))

import { YoutubePlayer } from '../components/YoutubePlayer'

const mockPlayer = {
  seekTo: jest.fn(),
  unMute: jest.fn(),
  mute: jest.fn(),
  setVolume: jest.fn(),
  destroy: jest.fn(),
  getPlayerState: jest.fn(() => 1),
  getCurrentTime: jest.fn(() => 0),
  playVideo: jest.fn(),
  pauseVideo: jest.fn(),
  cueVideoById: jest.fn(),
  loadVideoById: jest.fn(),
}

let mockOnStateChange: any;

beforeEach(() => {
  jest.clearAllMocks()
  mockOnStateChange = undefined;
  
  window.YT = {
    Player: jest.fn().mockImplementation((_el, opts) => {
      // Fire callbacks asynchronously so `player` ref is assigned before they run
      setTimeout(() => {
        act(() => {
          opts?.events?.onReady?.({ target: mockPlayer })
          mockOnStateChange = opts?.events?.onStateChange;
          mockOnStateChange?.({ data: 1, target: mockPlayer }) // PLAYING
        })
      }, 0)
      return mockPlayer
    }),
  } as unknown as typeof window.YT
})

describe('YoutubePlayer', () => {
  const baseProps = { videoId: 'abc123' }

  it('renders the player container', () => {
    render(<YoutubePlayer {...baseProps} />)
    expect(screen.getByTestId('yt-player-container')).toBeInTheDocument()
  })

  it('calls unMute and setVolume when PLAYING state fires', async () => {
    render(<YoutubePlayer {...baseProps} />)
    
    await waitFor(() => expect(mockPlayer.unMute).toHaveBeenCalled())
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(100)
  })

  it('calls onEnded when ENDED custom event fires on container', async () => {
    const onEnded = jest.fn()
    render(<YoutubePlayer {...baseProps} onEnded={onEnded} />)
    
    await waitFor(() => {
      expect(mockOnStateChange).toBeDefined()
    })

    act(() => {
      mockOnStateChange({ data: 0, target: mockPlayer })
    })

    await waitFor(() => expect(onEnded).toHaveBeenCalled())
  })

  it('seeks to offset when playingSince is set', async () => {
    const playingSince = new Date(Date.now() - 30_000).toISOString()
    render(<YoutubePlayer {...baseProps} playingSince={playingSince} />)

    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(expect.any(Number), true))
  })

  it('uses custom volume when PLAYING state fires', async () => {
    render(<YoutubePlayer {...baseProps} volume={50} />)

    await waitFor(() => expect(mockPlayer.unMute).toHaveBeenCalled())
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(50)
  })

  it('mutes player when volume=0 and PLAYING fires', async () => {
    render(<YoutubePlayer {...baseProps} volume={0} />)

    await waitFor(() => expect(mockPlayer.mute).toHaveBeenCalled())
    // unMute should not have been called for volume=0
    expect(mockPlayer.unMute).not.toHaveBeenCalled()
  })

  it('applies new volume via effect when volume prop changes', async () => {
    const { rerender } = render(<YoutubePlayer {...baseProps} volume={100} />)

    await waitFor(() => expect(mockPlayer.setVolume).toHaveBeenCalledWith(100))

    jest.clearAllMocks()
    rerender(<YoutubePlayer {...baseProps} volume={40} />)

    await waitFor(() => expect(mockPlayer.setVolume).toHaveBeenCalledWith(40))
    expect(mockPlayer.unMute).toHaveBeenCalled()
  })

  it('mutes via effect when volume prop changes to 0', async () => {
    const { rerender } = render(<YoutubePlayer {...baseProps} volume={80} />)

    await waitFor(() => expect(mockPlayer.setVolume).toHaveBeenCalledWith(80))

    jest.clearAllMocks()
    rerender(<YoutubePlayer {...baseProps} volume={0} />)

    await waitFor(() => expect(mockPlayer.mute).toHaveBeenCalled())
    expect(mockPlayer.unMute).not.toHaveBeenCalled()
  })
})
