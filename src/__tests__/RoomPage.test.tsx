import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import RoomPage from '../app/room/[code]/page';
import { useQueue } from '../hooks/useQueue';
import { useParams } from 'next/navigation';
import { getCurrentUser, signInAnonymously } from '../lib/auth';

// Mock dependencies
jest.mock('../hooks/useQueue');
jest.mock('next/navigation');
jest.mock('../lib/auth');

jest.mock('../components/NowPlaying', () => ({
  NowPlaying: ({ currentTrack, onTrackChange }: any) => (
    <div data-testid="mock-now-playing">
      {currentTrack ? `Playing: ${currentTrack.title}` : 'Nothing playing'}
      <button data-testid="advance-btn" onClick={onTrackChange}>Advance</button>
    </div>
  ),
}));

jest.mock('../components/Queue', () => ({
  Queue: () => <div data-testid="mock-queue">Mock Queue</div>,
}));

jest.mock('../components/Leaderboard', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-leaderboard">Mock Leaderboard</div>,
}));

describe('RoomPage Orchestration', () => {
  const mockParams = { code: 'TEST12' };
  const mockUser = { id: 'user-123' };
  
  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue(mockParams);
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (signInAnonymously as jest.Mock).mockResolvedValue({ user: mockUser, error: null });
  });

  it('renders authenticating state initially', async () => {
    (useQueue as jest.Mock).mockReturnValue({
      items: [],
      playing: null,
      loading: true,
      error: null,
    });

    render(<RoomPage />);
    expect(screen.getByText(/authenticating/i)).toBeInTheDocument();
  });

  it('renders room components when data is loaded', async () => {
    (useQueue as jest.Mock).mockReturnValue({
      items: [
        { id: '1', video_id: 'abc', title: 'Test Video', position: 1, status: 'playing' },
      ],
      playing: { id: '1', video_id: 'abc', title: 'Test Video', position: 1, status: 'playing' },
      loading: false,
      error: null,
      advanceQueue: jest.fn(),
    });

    render(<RoomPage />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-now-playing')).toBeInTheDocument();
      expect(screen.getByTestId('mock-queue')).toBeInTheDocument();
      expect(screen.getByTestId('mock-leaderboard')).toBeInTheDocument();
      // Use more flexible matcher for fragmented text
      expect(screen.getByRole('heading', { name: /ROOM \/ TEST12/i })).toBeInTheDocument();
    });
  });

  it('calls advanceQueue when track ends', async () => {
    const mockAdvanceQueue = jest.fn();
    (useQueue as jest.Mock).mockReturnValue({
      items: [
        { id: '1', video_id: 'abc', title: 'Test Video', position: 1, status: 'playing' },
      ],
      playing: { id: '1', video_id: 'abc', title: 'Test Video', position: 1, status: 'playing' },
      loading: false,
      error: null,
      advanceQueue: mockAdvanceQueue,
    });

    render(<RoomPage />);

    await waitFor(() => {
      expect(screen.getByTestId('advance-btn')).toBeInTheDocument();
    });

    act(() => {
      screen.getByTestId('advance-btn').click();
    });

    expect(mockAdvanceQueue).toHaveBeenCalled();
  });

  it('shows winner notification toast when track advances to a new track', async () => {
    const track1 = { id: '1', title: 'Track 1', status: 'playing' };
    const track2 = { id: '2', title: 'Track 2', status: 'playing' };
    const { rerender } = render(<RoomPage />);

    // Mock initial state: track1 playing
    (useQueue as jest.Mock).mockReturnValue({
      items: [track1],
      playing: track1,
      loading: false,
      error: null,
      advanceQueue: jest.fn(),
    });

    rerender(<RoomPage />);
    
    // Simulating advance to track2
    (useQueue as jest.Mock).mockReturnValue({
      items: [track2],
      playing: track2,
      loading: false,
      error: null,
      advanceQueue: jest.fn(),
    });

    rerender(<RoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Next Winner:/i)).toBeInTheDocument();
      expect(screen.getByText('Track 2')).toBeInTheDocument();
    });
  });
});
