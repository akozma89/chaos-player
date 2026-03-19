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
    it('shows a helpful, styled "No results" message with the query', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: [], error: null })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      const query = 'nonexistent track xyz'
      fireEvent.change(input, { target: { value: query } })

      await waitFor(() => {
        const emptyState = screen.getByText(`No results for “${query}”`)
        expect(emptyState).toBeInTheDocument()
        expect(emptyState).toHaveClass('mt-2 px-3 py-2 text-zinc-500 text-sm text-center')
      })
    })

    it('does not show "No results" when query is empty', () => {
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      expect(screen.queryByText(/no results/i)).not.toBeInTheDocument()
    })

    it('does not show "No results" while search is in progress', async () => {
      let resolveSearch!: (val: unknown) => void
      searchYouTubeWithErrors.mockReturnValue(
        new Promise((r) => {
          resolveSearch = r
        })
      )
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'loading' } })

      expect(screen.queryByText(/no results/i)).not.toBeInTheDocument()

      await act(async () => {
        resolveSearch({ results: [], error: null })
      })
    })

    it('does not show "No results" if there is an error', async () => {
      searchYouTubeWithErrors.mockResolvedValue({ results: [], error: { type: 'api_error', message: 'Test error' } })
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'a query' } })

      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument()
      })
      expect(screen.queryByText(/no results/i)).not.toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation and Scrolling', () => {
    const MOCK_RESULTS_LONG = Array.from({ length: 10 }, (_, i) => ({
      sourceId: `${i + 1}`,
      title: `Track ${i + 1}`,
      channelTitle: `C${i + 1}`,
      thumbnailUrl: '',
      duration: 100 + i,
    }))

    beforeEach(() => {
      window.HTMLElement.prototype.scrollIntoView = jest.fn()
      searchYouTubeWithErrors.mockResolvedValue({ results: MOCK_RESULTS_LONG, error: null })
    })

    it('results list has max-h and overflow-y-auto for scrollability', async () => {
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.getByText('Track 1')).toBeInTheDocument()
      })

      const list = screen.getByRole('list')
      expect(list.className).toMatch(/overflow-y-auto/)
      expect(list.className).toMatch(/max-h-64/)
    })

    it('highlights results when navigating with ArrowDown/ArrowUp', async () => {
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

    it('calls scrollIntoView on the highlighted item when navigating down a long list', async () => {
      const mockScrollIntoView = jest.fn()
      window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView

      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.getByText('Track 1')).toBeInTheDocument()
      })

      // Navigate down multiple times
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(input, { key: 'ArrowDown' })
      }

      expect(mockScrollIntoView).toHaveBeenCalledTimes(5)
      expect(mockScrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    })

    it('adds selected item to queue when Enter is pressed and clears results/query', async () => {
      const { addToQueue } = require('../lib/queue')
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.getByText('Track 1')).toBeInTheDocument()
      })

      // Select 1st item
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      // Press Enter
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(addToQueue).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceId: '1',
            title: 'Track 1',
          })
        )
      })

      // Verify results and query are cleared
      await waitFor(() => {
        expect((input as HTMLInputElement).value).toBe('')
        expect(screen.queryByText('Track 1')).not.toBeInTheDocument()
      })
    })

    it('clears results/query when clicking Add button', async () => {
      const { addToQueue } = require('../lib/queue')
      render(<YouTubeSearch roomId="room-1" userId="user-1" />)
      const input = screen.getByPlaceholderText('Search YouTube...')
      fireEvent.change(input, { target: { value: 'test' } })

      await waitFor(() => {
        expect(screen.getByText('Track 1')).toBeInTheDocument()
      })

      const addBtn = screen.getAllByText('+ Add')[0]
      fireEvent.click(addBtn)

      await waitFor(() => {
        expect(addToQueue).toHaveBeenCalled()
        expect((input as HTMLInputElement).value).toBe('')
        expect(screen.queryByText('Track 1')).not.toBeInTheDocument()
      })
    })
  })
})
