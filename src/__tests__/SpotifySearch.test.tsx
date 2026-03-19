/**
 * Tests for SpotifySearch component
 * - Shows ConnectSpotify when no access token
 * - Shows search input when connected
 * - Displays search results
 * - Adds track to queue
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SpotifySearch from '../components/SpotifySearch'

jest.mock('../lib/spotify', () => ({
  searchSpotify: jest.fn().mockResolvedValue({ items: [], error: null }),
}))
jest.mock('../lib/queue', () => ({
  addToQueue: jest.fn().mockResolvedValue({ data: null, error: null }),
}))
jest.mock('../hooks/useDebounce', () => ({
  useDebounce: (val: string) => val,
}))
jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
jest.mock('../components/ConnectSpotify', () => ({
  __esModule: true,
  default: ({ onConnected }: { onConnected: (token: string) => void }) => (
    <button onClick={() => onConnected('mock-token')}>Connect Spotify</button>
  ),
}))

const { searchSpotify } = require('../lib/spotify')

const MOCK_RESULTS = [
  {
    sourceId: 'track-1',
    source: 'spotify',
    title: 'Spotify Song',
    artist: 'Spotify Artist',
    thumbnailUrl: 'https://img.example.com/cover.jpg',
    duration: 210,
  },
]

describe('SpotifySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    searchSpotify.mockResolvedValue({ items: [], error: null })
  })

  it('shows ConnectSpotify when no accessToken provided', () => {
    render(<SpotifySearch roomId="r1" userId="u1" clientId="cid" />)
    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeInTheDocument()
  })

  it('shows search input when accessToken is provided', () => {
    render(<SpotifySearch roomId="r1" userId="u1" clientId="cid" accessToken="tok" />)
    expect(screen.getByPlaceholderText(/search spotify/i)).toBeInTheDocument()
  })

  it('shows search input after connecting via ConnectSpotify', async () => {
    render(<SpotifySearch roomId="r1" userId="u1" clientId="cid" />)
    fireEvent.click(screen.getByRole('button', { name: /connect spotify/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search spotify/i)).toBeInTheDocument()
    })
  })

  it('displays search results', async () => {
    searchSpotify.mockResolvedValue({ items: MOCK_RESULTS, error: null })
    render(<SpotifySearch roomId="r1" userId="u1" clientId="cid" accessToken="tok" />)
    const input = screen.getByPlaceholderText(/search spotify/i)
    fireEvent.change(input, { target: { value: 'Spotify Song' } })

    await waitFor(() => {
      expect(screen.getByText('Spotify Song')).toBeInTheDocument()
    })
  })

  it('adds track to queue on click', async () => {
    const { addToQueue } = require('../lib/queue')
    searchSpotify.mockResolvedValue({ items: MOCK_RESULTS, error: null })
    render(<SpotifySearch roomId="r1" userId="u1" clientId="cid" accessToken="tok" />)
    fireEvent.change(screen.getByPlaceholderText(/search spotify/i), { target: { value: 'Spotify Song' } })

    await waitFor(() => {
      expect(screen.getByText('Spotify Song')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /\+ add/i })[0])

    await waitFor(() => {
      expect(addToQueue).toHaveBeenCalledWith(expect.objectContaining({
        sourceId: 'track-1',
        source: 'spotify',
        title: 'Spotify Song',
      }))
    })
  })

  it('shows "No results" when search returns empty', async () => {
    searchSpotify.mockResolvedValue({ items: [], error: null })
    render(<SpotifySearch roomId="r1" userId="u1" clientId="cid" accessToken="tok" />)
    fireEvent.change(screen.getByPlaceholderText(/search spotify/i), { target: { value: 'nothing' } })

    await waitFor(() => {
      expect(screen.getByText(/no results/i)).toBeInTheDocument()
    })
  })

  it('shows error message on search error', async () => {
    searchSpotify.mockResolvedValue({ items: [], error: new Error('Search failed') })
    render(<SpotifySearch roomId="r1" userId="u1" clientId="cid" accessToken="tok" />)
    fireEvent.change(screen.getByPlaceholderText(/search spotify/i), { target: { value: 'broken' } })

    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument()
    })
  })
})
