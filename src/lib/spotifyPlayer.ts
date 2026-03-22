/**
 * Spotify Web Playback SDK loader and types
 * Ref: https://developer.spotify.com/documentation/web-playback-sdk
 */

export interface SpotifyTrack {
  id: string
  name: string
  duration_ms: number
  artists: Array<{ name: string }>
  album: { images: Array<{ url: string }> }
}

export interface SpotifyPlayerState {
  paused: boolean
  position: number  // ms
  duration: number  // ms
  track_window: {
    current_track: SpotifyTrack
    previous_tracks: SpotifyTrack[]
    next_tracks: SpotifyTrack[]
  }
}

export type SpotifySDKPlayer = {
  connect(): Promise<boolean>
  disconnect(): void
  pause(): Promise<void>
  resume(): Promise<void>
  togglePlay(): Promise<void>
  seek(positionMs: number): Promise<void>
  setVolume(volume: number): Promise<void>  // 0.0–1.0
  getCurrentState(): Promise<SpotifyPlayerState | null>
  addListener(event: 'ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'not_ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'player_state_changed', cb: (state: SpotifyPlayerState | null) => void): void
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    cb: (data: { message: string }) => void
  ): void
  removeListener(event: string): void
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: {
      Player: new (opts: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifySDKPlayer
    }
  }
}

let sdkPromise: Promise<void> | null = null

/**
 * Promise-based loader for the Spotify Web Playback SDK.
 * The SDK calls window.onSpotifyWebPlaybackSDKReady when ready.
 */
export function loadSpotifySDK(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve) => {
    if (window.Spotify) {
      resolve()
      return
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    document.head.appendChild(script)
  })

  return sdkPromise
}
