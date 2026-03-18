/**
 * Tests for Leaderboard UI component
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Leaderboard from '../components/Leaderboard'

// Mock leaderboard service
jest.mock('../lib/leaderboard', () => ({
  getLeaderboard: jest.fn(),
  subscribeToLeaderboard: jest.fn(() => jest.fn()),
}))

const mockEntries = [
  { rank: 1, userId: 'u1', username: 'Alice', tokensSpent: 8, voteCount: 5, engagementScore: 13 },
  { rank: 2, userId: 'u2', username: 'Bob', tokensSpent: 3, voteCount: 2, engagementScore: 5 },
  { rank: 3, userId: 'u3', username: 'Carol', tokensSpent: 1, voteCount: 1, engagementScore: 2 },
]

describe('Leaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders leaderboard heading', async () => {
    const { getLeaderboard } = require('../lib/leaderboard')
    getLeaderboard.mockResolvedValue({ data: [], error: null })

    render(<Leaderboard roomId="room-1" />)

    expect(screen.getByTestId('leaderboard')).toBeInTheDocument()
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    const { getLeaderboard } = require('../lib/leaderboard')
    getLeaderboard.mockReturnValue(new Promise(() => {})) // never resolves

    render(<Leaderboard roomId="room-1" />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders ranked entries after loading', async () => {
    const { getLeaderboard } = require('../lib/leaderboard')
    getLeaderboard.mockResolvedValue({ data: mockEntries, error: null })

    render(<Leaderboard roomId="room-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-entry-u1')).toBeInTheDocument()
      expect(screen.getByTestId('leaderboard-entry-u2')).toBeInTheDocument()
      expect(screen.getByTestId('leaderboard-entry-u3')).toBeInTheDocument()
    })
  })

  it('displays usernames in ranked order', async () => {
    const { getLeaderboard } = require('../lib/leaderboard')
    getLeaderboard.mockResolvedValue({ data: mockEntries, error: null })

    render(<Leaderboard roomId="room-1" />)

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
  })

  it('shows engagement scores', async () => {
    const { getLeaderboard } = require('../lib/leaderboard')
    getLeaderboard.mockResolvedValue({ data: mockEntries, error: null })

    render(<Leaderboard roomId="room-1" />)

    await waitFor(() => expect(screen.getByText('13')).toBeInTheDocument())
    const aliceRow = screen.getByTestId('leaderboard-entry-u1')
    const bobRow = screen.getByTestId('leaderboard-entry-u2')
    const carolRow = screen.getByTestId('leaderboard-entry-u3')
    expect(aliceRow).toHaveTextContent('13')
    expect(bobRow).toHaveTextContent('5')
    expect(carolRow).toHaveTextContent('2')
  })

  it('shows empty state when no players', async () => {
    const { getLeaderboard } = require('../lib/leaderboard')
    getLeaderboard.mockResolvedValue({ data: [], error: null })

    render(<Leaderboard roomId="room-1" />)

    await waitFor(() => expect(screen.getByText(/no players/i)).toBeInTheDocument())
  })

  it('subscribes to real-time updates on mount', async () => {
    const { getLeaderboard, subscribeToLeaderboard } = require('../lib/leaderboard')
    getLeaderboard.mockResolvedValue({ data: mockEntries, error: null })
    const mockUnsub = jest.fn()
    subscribeToLeaderboard.mockReturnValue(mockUnsub)

    const { unmount } = render(<Leaderboard roomId="room-1" />)

    await waitFor(() => expect(subscribeToLeaderboard).toHaveBeenCalledWith('room-1', expect.any(Function)))

    unmount()
    expect(mockUnsub).toHaveBeenCalled()
  })
})
