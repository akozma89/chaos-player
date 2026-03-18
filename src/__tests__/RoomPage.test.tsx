import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import RoomPage from '../app/room/[code]/page';
import { useQueue } from '../hooks/useQueue';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser, signInAnonymously } from '../lib/auth';
import { getRoomByCode } from '../lib/rooms';

// Mock dependencies
jest.mock('../hooks/useQueue');
jest.mock('next/navigation');
jest.mock('../lib/auth');
jest.mock('../lib/rooms');

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

jest.mock('../components/YouTubeSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-youtube-search">Mock YouTubeSearch</div>,
}));

describe('RoomPage Orchestration', () => {
  const mockParams = { code: 'TEST12' };
  const mockUser = { id: 'user-123' };
  const mockRoom = { id: 'room-uuid', code: 'TEST12', name: 'Test Room' };
  const mockPush = jest.fn();

  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue(mockParams);
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (signInAnonymously as jest.Mock).mockResolvedValue({ user: mockUser, error: null });
    (getRoomByCode as jest.Mock).mockResolvedValue({ data: mockRoom, error: null });
  });

  it('renders authenticating state initially', async () => {
    (useQueue as jest.Mock).mockReturnValue({
      items: [],
      playing: null,
      loading: true,
      error: null,
    });

    render(<RoomPage />);
    // Initially shows "Finding Room..." or "Loading Room..." during async init
    expect(screen.getByText(/Finding Room|Authenticating|Loading Room/i)).toBeInTheDocument();
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

    (useQueue as jest.Mock).mockReturnValue({
      items: [track1],
      playing: track1,
      loading: false,
      error: null,
      advanceQueue: jest.fn(),
      pending: [],
      vote: jest.fn(),
      refresh: jest.fn(),
    });

    const { rerender } = render(<RoomPage />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-now-playing')).toBeInTheDocument();
    });

    // Simulating advance to track2
    (useQueue as jest.Mock).mockReturnValue({
      items: [track2],
      playing: track2,
      loading: false,
      error: null,
      advanceQueue: jest.fn(),
      pending: [],
      vote: jest.fn(),
      refresh: jest.fn(),
    });

    rerender(<RoomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Next Winner:/i)).toBeInTheDocument();
      expect(screen.getByText('Track 2')).toBeInTheDocument();
    });
  });

  it('winner toast does not re-appear when playing track data refreshes with the same track ID', async () => {
    // Regression test: lastTrackId must be updated after each transition.
    // Bug: setLastTrackId was only called when lastTrackId === null (initial startup).
    // After first transition lastTrackId stayed stuck at track-1's ID, so any
    // realtime refresh of playing (new object, same ID) re-triggered the toast.
    const track1 = { id: 'track-1', title: 'Track 1', status: 'playing' };
    const track2a = { id: 'track-2', title: 'Track 2', status: 'playing' };
    // Same ID as track2a but a different JS object (simulates realtime vote update)
    const track2b = { id: 'track-2', title: 'Track 2', status: 'playing' };

    const makeQueueMock = (playing: any) => ({
      items: playing ? [playing] : [],
      playing,
      pending: [],
      loading: false,
      error: null,
      advanceQueue: jest.fn(),
      vote: jest.fn(),
      refresh: jest.fn(),
    });

    (useQueue as jest.Mock).mockReturnValue(makeQueueMock(track1));
    const { rerender } = render(<RoomPage />);

    await waitFor(() => expect(screen.getByTestId('mock-now-playing')).toBeInTheDocument());

    // Advance to track2a → toast should appear
    (useQueue as jest.Mock).mockReturnValue(makeQueueMock(track2a));
    act(() => { rerender(<RoomPage />); });

    await waitFor(() => expect(screen.getByTestId('winner-toast')).toBeInTheDocument());

    // Dismiss the toast via the dismiss button
    act(() => { screen.getByRole('button', { name: /Dismiss/i }).click(); });

    await waitFor(() => expect(screen.queryByTestId('winner-toast')).not.toBeInTheDocument());

    // Realtime refresh: same track-2 ID, new JS object (e.g., vote count updated)
    (useQueue as jest.Mock).mockReturnValue(makeQueueMock(track2b));
    act(() => { rerender(<RoomPage />); });

    // Toast must NOT re-appear — same track is still playing
    expect(screen.queryByTestId('winner-toast')).not.toBeInTheDocument();
  });
});
