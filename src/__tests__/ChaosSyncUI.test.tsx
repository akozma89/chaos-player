import React from 'react'
import { render, screen } from '@testing-library/react'
import { YoutubePlayer } from '../components/YoutubePlayer'
import '@testing-library/jest-dom'

jest.mock('../lib/youtubeIframe', () => ({
  loadYouTubeIframeAPI: jest.fn().mockResolvedValue({}),
  YT_STATES: { PLAYING: 1, ENDED: 0 },
}))

describe('YoutubePlayer with Chaos Sync', () => {
  it('renders ChaosSyncOverlay when isSyncing is true', () => {
    // @ts-ignore - we know we haven't added isSyncing to props yet
    render(<YoutubePlayer videoId="v1" isHost={true} isSyncing={true} />)
    
    expect(screen.getByTestId('chaos-sync-overlay')).toBeInTheDocument()
    expect(screen.getByText(/Chaos Syncing/i)).toBeInTheDocument()
  })

  it('does NOT render ChaosSyncOverlay when isSyncing is false', () => {
    // @ts-ignore
    render(<YoutubePlayer videoId="v1" isHost={true} isSyncing={false} />)
    
    expect(screen.queryByTestId('chaos-sync-overlay')).not.toBeInTheDocument()
  })
})
