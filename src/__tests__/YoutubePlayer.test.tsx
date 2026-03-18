/**
 * Task 3 (RED): Tests for YouTube IFrame player component
 * Tests: onReady, onStateChange(ENDED), host-only control gate
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock the YouTube IFrame API loader
jest.mock('../lib/youtubeIframe', () => ({
  loadYouTubeIframeAPI: jest.fn(() => Promise.resolve()),
  YT_STATES: {
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
  },
}))

import { YoutubePlayer } from '../components/YoutubePlayer'

describe('YoutubePlayer', () => {
  const baseProps = {
    videoId: 'abc123',
    isHost: false,
    onEnded: jest.fn(),
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders an iframe container div', () => {
    render(<YoutubePlayer {...baseProps} />)
    expect(document.getElementById('yt-player')).toBeInTheDocument()
  })

  it('calls onEnded callback when track ends', () => {
    const onEnded = jest.fn()
    const { container } = render(<YoutubePlayer {...baseProps} onEnded={onEnded} />)

    // Simulate the player state change event via the component's exposed handler
    const playerDiv = container.querySelector('[data-testid="yt-player-container"]')
    expect(playerDiv).toBeInTheDocument()

    // Trigger ended via custom event
    fireEvent(playerDiv!, new CustomEvent('yt-state-change', { detail: { state: 0 } }))

    expect(onEnded).toHaveBeenCalledTimes(1)
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

  it('does not show skip button if isHost is false even if onSkip is provided', () => {
    render(<YoutubePlayer {...baseProps} isHost={false} onSkip={jest.fn()} />)
    expect(screen.queryByTestId('host-skip-btn')).not.toBeInTheDocument()
  })
})
