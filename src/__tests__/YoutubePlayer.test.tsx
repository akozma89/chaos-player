import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('../lib/youtubeIframe', () => ({
  loadYouTubeIframeAPI: jest.fn(() => Promise.resolve()),
  YT_STATES: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
}))

import { YoutubePlayer } from '../components/YoutubePlayer'

const mockPlayer = {
  seekTo: jest.fn(),
  unMute: jest.fn(),
  setVolume: jest.fn(),
  destroy: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  window.YT = {
    Player: jest.fn().mockImplementation((_el, opts) => {
      // Fire callbacks asynchronously so `player` ref is assigned before they run
      Promise.resolve().then(() => {
        opts?.events?.onReady?.()
        opts?.events?.onStateChange?.({ data: 1 }) // PLAYING
      })
      return mockPlayer
    }),
  } as unknown as typeof window.YT
})

describe('YoutubePlayer', () => {
  const baseProps = { videoId: 'abc123', isHost: false }

  it('renders the player container', () => {
    render(<YoutubePlayer {...baseProps} />)
    expect(screen.getByTestId('yt-player-container')).toBeInTheDocument()
  })

  it('calls unMute and setVolume when PLAYING state fires and guard is cleared', async () => {
    render(<YoutubePlayer {...baseProps} />)
    
    // Guard should be visible
    const joinBtn = screen.getByText(/JOIN & PLAY/i)
    fireEvent.click(joinBtn)

    await waitFor(() => expect(mockPlayer.unMute).toHaveBeenCalled())
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(100)
  })

  it('calls onEnded when ENDED custom event fires on container', async () => {
    const onEnded = jest.fn()
    const { container } = render(<YoutubePlayer {...baseProps} onEnded={onEnded} />)
    
    // Clear guard
    fireEvent.click(screen.getByText(/JOIN & PLAY/i))

    const playerDiv = container.querySelector('[data-testid="yt-player-container"]')!
    fireEvent(playerDiv, new CustomEvent('yt-state-change', { detail: { state: 0 } }))
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it('seeks to offset when playingSince is set', async () => {
    const playingSince = new Date(Date.now() - 30_000).toISOString()
    render(<YoutubePlayer {...baseProps} playingSince={playingSince} />)

    // Clear guard
    fireEvent.click(screen.getByText(/JOIN & PLAY/i))

    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(expect.any(Number)))
  })

  it('shows skip button only for host', () => {
    const { rerender } = render(<YoutubePlayer {...baseProps} isHost={false} />)
    expect(screen.queryByTestId('host-skip-btn')).not.toBeInTheDocument()
    rerender(<YoutubePlayer {...baseProps} isHost={true} />)
    expect(screen.getByTestId('host-skip-btn')).toBeInTheDocument()
  })

  it('calls onSkip when host clicks skip', () => {
    const onSkip = jest.fn()
    render(<YoutubePlayer {...baseProps} isHost={true} onSkip={onSkip} />)
    fireEvent.click(screen.getByTestId('host-skip-btn'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('does not show skip button when isHost is false even with onSkip provided', () => {
    render(<YoutubePlayer {...baseProps} isHost={false} onSkip={jest.fn()} />)
    expect(screen.queryByTestId('host-skip-btn')).not.toBeInTheDocument()
  })
})
