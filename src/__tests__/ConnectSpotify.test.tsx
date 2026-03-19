import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectSpotify from '../components/ConnectSpotify';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildSpotifyAuthUrl,
} from '../lib/spotify';
import { loadSession, clearSession } from '../lib/spotifySession';

// Mock dependencies
jest.mock('../lib/spotify', () => ({
  generateCodeVerifier: jest.fn(),
  generateCodeChallenge: jest.fn(),
  buildSpotifyAuthUrl: jest.fn(),
}));

jest.mock('../lib/spotifySession', () => ({
  loadSession: jest.fn(),
  clearSession: jest.fn(),
}));

const mockLoadSession = loadSession as jest.Mock;
const mockClearSession = clearSession as jest.Mock;
const mockGenerateCodeVerifier = generateCodeVerifier as jest.Mock;
const mockGenerateCodeChallenge = generateCodeChallenge as jest.Mock;
const mockBuildSpotifyAuthUrl = buildSpotifyAuthUrl as jest.Mock;

describe('ConnectSpotify', () => {
  const mockOnConnected = jest.fn();
  const mockOnDisconnected = jest.fn();
  const clientId = 'test-client-id';
  const redirectUri = 'http://localhost/callback';
  const authUrl = 'https://spotify.com/auth';

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadSession.mockReturnValue(null);
    mockGenerateCodeVerifier.mockReturnValue('test-verifier');
    mockGenerateCodeChallenge.mockResolvedValue('test-challenge');
    mockBuildSpotifyAuthUrl.mockReturnValue(authUrl);
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        },
        writable: true,
      })
  });

  it('renders "Connect Spotify" button when not connected', () => {
    render(
      <ConnectSpotify
        clientId={clientId}
        onConnected={mockOnConnected}
        onDisconnected={mockOnDisconnected}
      />
    );
    expect(screen.getByRole('button', { name: /Connect Spotify/i })).toBeInTheDocument();
  });

  it('renders "Disconnect" button when session is active', () => {
    mockLoadSession.mockReturnValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
    });
    render(
      <ConnectSpotify
        clientId={clientId}
        onConnected={mockOnConnected}
        onDisconnected={mockOnDisconnected}
      />
    );
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
  });

  it('initiates auth flow on connect click', async () => {
    render(
      <ConnectSpotify
        clientId={clientId}
        redirectUri={redirectUri}
        onConnected={mockOnConnected}
        onDisconnected={mockOnDisconnected}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect Spotify/i }));

    await waitFor(() => {
      expect(mockGenerateCodeVerifier).toHaveBeenCalled();
      expect(sessionStorage.setItem).toHaveBeenCalledWith('spotify_pkce_verifier', 'test-verifier');
    });

    await waitFor(() => {
      expect(mockGenerateCodeChallenge).toHaveBeenCalledWith('test-verifier');
    });

    await waitFor(() => {
      expect(mockBuildSpotifyAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId,
          redirectUri,
          codeChallenge: 'test-challenge',
        })
      );
    });
  });

  it('calls onDisconnected and clears session on disconnect click', () => {
    mockLoadSession.mockReturnValue({
      accessToken: 'token',
      expiresAt: Date.now() + 10000,
    });
    render(
      <ConnectSpotify
        clientId={clientId}
        onConnected={mockOnConnected}
        onDisconnected={mockOnDisconnected}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));

    expect(mockClearSession).toHaveBeenCalled();
    expect(mockOnDisconnected).toHaveBeenCalled();
  });
});
