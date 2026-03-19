import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import YouTubeSearch from '../components/YouTubeSearch'

// Mock dependencies
jest.mock('../lib/youtube', () => ({
  searchYouTubeWithErrors: jest.fn().mockResolvedValue({ results: [], error: null }),
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

const { searchYouTubeWithErrors } = require('../lib/youtube')

const MOCK_RESULTS = [
  {
    sourceId: 'vid1',
    title: 'Test Track',
    channelTitle: 'Test Channel',
    thumbnailUrl: 'https://img.youtube.com/vi/vid1/mqdefault.jpg',
    duration: 200,
  },
]

describe('YouTubeSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    searchYouTubeWithErrors.mockResolvedValue({ results: [], error: null })
  })

  it('renders the search input', () => {
    render(<YouTubeSearch roomId="room-1" userId="user-1" />)
    expect(screen.getByPlaceholderText('Search YouTube...')).toBeInTheDocument()
  })

  describe('clear button', () => {
    it('shows clear button when query is non-empty', async () => {
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'hello' } })
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })

    it('does not show clear button when query is empty', () => {
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
    })

    it('clears the input and results when clear button is clicked', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS, error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      // Wait for results to appear
      await waitFor(() => {
        expect(screen.queryByText('Test Track')).toBeInTheDocument()
      })

      const clearBtn = screen.getByRole('button', { name: /clear/i })
      fireEvent.click(clearBtn)

      expect((input as HTMLInputElement).value).toBe('')
      expect(screen.queryByText('Test Track')).not.toBeInTheDocument()
    })
  })

  describe('z-index', () => {
    it('results list has z-50 class to layer above other content', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS, error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.queryByText('Test Track')).toBeInTheDocument()
      })

      const list = screen.getByRole('list')
      expect(list.className).toMatch(/z-50/)
    })
  })

  describe('Escape key dismiss', () => {
    it('closes results dropdown when Escape is pressed', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS, error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.queryByText('Test Track')).toBeInTheDocument()
      })

      fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

      expect(screen.queryByText('Test Track')).not.toBeInTheDocument()
    })
  })

  describe('outside-click dismiss', () => {
    it('closes results when clicking outside the component', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS, error: null })
      render(
        <div>
          <YouTubeSearch roomId="room-1" userId="user-1" />
          <div data-testid="outside">Outside</div>
        </div>
      )
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.queryByText('Test Track')).toBeInTheDocument()
      })

      fireEvent.mouseDown(screen.getByTestId('outside'))

      expect(screen.queryByText('Test Track')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows "No results" message when query is non-empty and search returns empty results', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: [], error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'nonexistent track xyz' } })

      await waitFor(() => {
        expect(screen.getByText(/no results/i)).toBeInTheDocument()
      })
    })

    it('does not show "No results" when query is empty', () => {
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      expect(screen.queryByText(/no results/i)).not.toBeInTheDocument()
    })

    it('does not show "No results" while search is in progress', async () => {
      let resolveSearch!: (val: unknown) => void
      searchYouTubeWithErrors.mockReturnValue(new Promise((r) => { resolveSearch = r }))
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'loading' } })

      // While resolveSearch hasn't been called, search is still in progress
      expect(screen.queryByText(/no results/i)).not.toBeInTheDocument()

      await act(async () => {
        resolveSearch({ results: [], error: null })
      })
    })
  })

  describe('scrollable results list', () => {
    it('results list has max-h and overflow-y-auto for scrollability', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS, error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.queryByText('Test Track')).toBeInTheDocument()
      })

      const list = screen.getByRole('list')
      expect(list.className).toMatch(/overflow-y-auto/)
      expect(list.className).toMatch(/max-h-/)
    })
  })

  describe('Keyboard Navigation', () => {
    const MOCK_RESULTS_MULTI = [
      { sourceId: '1', title: 'Track 1', channelTitle: 'C1', thumbnailUrl: '', duration: 100 },
      { sourceId: '2', title: 'Track 2', channelTitle: 'C2', thumbnailUrl: '', duration: 200 },
    ]

    beforeEach(() => {
      window.HTMLElement.prototype.scrollIntoView = jest.fn()
    })

    it('highlights results when navigating with ArrowDown/ArrowUp', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS_MULTI, error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.getByText('Track 1')).toBeInTheDocument()
      })

      // ArrowDown to select first item
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      const item1 = screen.getByText('Track 1').closest('button')
      expect(item1).toHaveClass('bg-white/10')

      // ArrowDown to select second item
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      const item2 = screen.getByText('Track 2').closest('button')
      expect(item2).toHaveClass('bg-white/10')
      expect(item1).not.toHaveClass('bg-white/10')

      // ArrowUp to go back to first item
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(item1).toHaveClass('bg-white/10')
      expect(item2).not.toHaveClass('bg-white/10')
    })

    it('calls scrollIntoView on the highlighted item when navigating with ArrowDown', async () => {
      const mockScrollIntoView = jest.fn()
      window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView

      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS_MULTI, error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.getByText('Track 1')).toBeInTheDocument()
      })

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(mockScrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    })

    it('calls scrollIntoView on the highlighted item when navigating with ArrowUp', async () => {
      const mockScrollIntoView = jest.fn()
      window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView

      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS_MULTI, error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.getByText('Track 1')).toBeInTheDocument()
      })

      // Go to second item, then back up
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      mockScrollIntoView.mockClear()
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(mockScrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    })

    it('adds selected item to queue when Enter is pressed', async () => {
      const { addToQueue } = require('../lib/queue')
      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS_MULTI, error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.getByText('Track 1')).toBeInTheDocument()
      })

      // Select first item
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      
      // Press Enter
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(addToQueue).toHaveBeenCalledWith(expect.objectContaining({
        sourceId: '1',
        title: 'Track 1',
      }))
    })
  })
})
