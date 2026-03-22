'use client'

import { useEffect, useRef, useState } from 'react'
import { loadSpotifySDK, type SpotifySDKPlayer, type SpotifyPlayerState } from '../lib/spotifyPlayer'
import { getValidToken } from '../lib/spotifySession'
import ChaosSyncOverlay from './ChaosSyncOverlay'

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? ''
const SPOTIFY_API = 'https://api.spotify.com/v1'

const DEBUG =
  typeof window !== 'undefined' &&
  new URL(window.location.href).searchParams.get('debug') === 'player'

const log = (label: string, data?: unknown) => {
  if (DEBUG) {
    const now = new Date()
    const ms = String(now.getMilliseconds()).padStart(3, '0')
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${ms}`
    console.log(`[${ts}] 🎵 ${label}`, data ?? '')
  }
}

interface SpotifyPlayerProps {
  trackId: string
  playingSince?: string | null
  pausedAt?: string | null
  isSyncing?: boolean
  isPaused?: boolean
  volume?: number
  onEnded?: () => void
}

export function SpotifyPlayer({
  trackId,
  playingSince,
  pausedAt,
  isSyncing = false,
  isPaused = false,
  volume = 100,
  onEnded,
}: SpotifyPlayerProps) {
  const playerRef = useRef<SpotifySDKPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [sdkError, setSdkError] = useState<string | null>(null)

  // Keep refs fresh so closures inside the SDK callbacks always see latest values
  const isPausedRef = useRef(isPaused)
  const volumeRef = useRef(volume)
  const trackIdRef = useRef(trackId)
  const onEndedRef = useRef(onEnded)

  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])
  useEffect(() => { volumeRef.current = volume }, [volume])
  useEffect(() => { trackIdRef.current = trackId }, [trackId])
  useEffect(() => { onEndedRef.current = onEnded }, [onEnded])

  // Helper: call Spotify REST API with a fresh token
  const spotifyFetch = async (path: string, options: RequestInit = {}) => {
    const token = await getValidToken({ clientId: CLIENT_ID })
    if (!token) throw new Error('No Spotify token')
    const res = await fetch(`${SPOTIFY_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    })
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error?.message ?? `Spotify API error ${res.status}`)
    }
    return res
  }

  // 1. Core playback synchronization — pause/resume when isPaused prop changes
  useEffect(() => {
    if (!isReady || !playerRef.current) return
    log(`isPaused effect: isPaused=${isPaused}`)
    if (isPaused) {
      playerRef.current.pause().catch((e) => log('pause error', e))
    } else {
      playerRef.current.resume().catch((e) => log('resume error', e))
    }
  }, [isPaused, isReady])

  // 2. Time synchronization — seek when playingSince changes (host unpaused → adjusted value)
  useEffect(() => {
    if (!isReady || !playerRef.current || !playingSince || isPaused) return

    const expectedMs = Date.now() - new Date(playingSince).getTime()
    playerRef.current.getCurrentState().then((state) => {
      if (!state) return
      const driftMs = Math.abs(expectedMs - state.position)
      log(`Time sync: expected=${(expectedMs / 1000).toFixed(2)}s, actual=${(state.position / 1000).toFixed(2)}s, drift=${(driftMs / 1000).toFixed(2)}s`)
      if (driftMs > 2000) {
        log(`🎯 Seeking to ${(expectedMs / 1000).toFixed(2)}s`)
        playerRef.current?.seek(Math.max(0, expectedMs)).catch((e) => log('seek error', e))
      }
    })
  }, [playingSince, isReady, isPaused])

  // 3. Volume synchronization
  useEffect(() => {
    if (!isReady || !playerRef.current) return
    log(`Volume effect: volume=${volume}`)
    playerRef.current.setVolume(volume / 100).catch((e) => log('setVolume error', e))
  }, [volume, isReady])

  // 4. Lifecycle & initialization — recreate player only when track changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof window === 'undefined') return

    log(`Initializing Spotify player for trackId=${trackId}`)
    let active = true
    let player: SpotifySDKPlayer | null = null

    loadSpotifySDK().then(async () => {
      if (!active || !window.Spotify?.Player) {
        log('⚠️  Skipping player creation: SDK not ready or component unmounted')
        return
      }

      player = new window.Spotify.Player({
        name: 'Chaos Player',
        getOAuthToken: (cb) => {
          getValidToken({ clientId: CLIENT_ID }).then((token) => {
            if (token) cb(token)
            else log('⚠️  getOAuthToken: no token available')
          })
        },
        volume: volumeRef.current / 100,
      })

      player.addListener('initialization_error', ({ message }) => {
        log('initialization_error', message)
        if (active) setSdkError(`Init error: ${message}`)
      })
      player.addListener('authentication_error', ({ message }) => {
        log('authentication_error', message)
        if (active) setSdkError(`Auth error: ${message}`)
      })
      player.addListener('account_error', ({ message }) => {
        log('account_error', message)
        if (active) setSdkError(`Account error: ${message} (Spotify Premium required)`)
      })
      player.addListener('playback_error', ({ message }) => {
        log('playback_error', message)
      })

      player.addListener('ready', async ({ device_id }) => {
        log(`🎮 ready: device_id=${device_id}`)
        if (!active) return

        deviceIdRef.current = device_id

        // Calculate starting offset
        let offsetMs = 0
        if (playingSince) {
          if (isPausedRef.current && pausedAt) {
            offsetMs = new Date(pausedAt).getTime() - new Date(playingSince).getTime()
          } else {
            offsetMs = Date.now() - new Date(playingSince).getTime()
          }
        }
        offsetMs = Math.max(0, offsetMs)
        log(`Starting playback at offset ${(offsetMs / 1000).toFixed(2)}s, isPaused=${isPausedRef.current}`)

        try {
          await spotifyFetch(`/me/player/play?device_id=${device_id}`, {
            method: 'PUT',
            body: JSON.stringify({
              uris: [`spotify:track:${trackIdRef.current}`],
              position_ms: offsetMs,
            }),
          })

          // If room is paused, immediately pause after starting so audio isn't heard
          if (isPausedRef.current) {
            await new Promise((r) => setTimeout(r, 300))
            await player!.pause()
            log('⏸️  Initial pause applied')
          }

          setIsReady(true)
        } catch (err) {
          log('Error starting playback', err)
          if (active) setSdkError(err instanceof Error ? err.message : 'Playback start failed')
        }
      })

      player.addListener('not_ready', ({ device_id }) => {
        log(`⚠️  not_ready: device_id=${device_id}`)
        if (active) setIsReady(false)
      })

      player.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
        if (!state || !active) return
        log(`📊 player_state_changed: paused=${state.paused}, pos=${(state.position / 1000).toFixed(2)}s, prevTracks=${state.track_window.previous_tracks.length}`)

        // Track-end detection: position resets to 0 and previous_tracks contains our track
        const justEnded =
          state.paused &&
          state.position === 0 &&
          state.track_window.previous_tracks.some((t) => t.id === trackIdRef.current)

        if (justEnded) {
          log('🏁 Track ended')
          onEndedRef.current?.()
        }
      })

      const connected = await player.connect()
      log(`connect() → ${connected}`)
      if (!connected && active) {
        setSdkError('Failed to connect to Spotify')
      }

      playerRef.current = player
    })

    return () => {
      log(`Cleaning up Spotify player for trackId=${trackId}`)
      active = false
      setIsReady(false)
      setSdkError(null)
      player?.disconnect()
      playerRef.current = null
      deviceIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]) // Only re-create on track change

  return (
    <div data-testid="spotify-player-container" className="relative w-full rounded-2xl overflow-hidden">
      {/* Spotify branding bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-white/5 rounded-2xl backdrop-blur-sm">
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-neon-green flex-shrink-0" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>

        {sdkError ? (
          <p className="text-red-400 text-xs font-mono flex-1 truncate">{sdkError}</p>
        ) : !isReady ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 border-2 border-neon-green/30 border-t-neon-green rounded-full animate-spin" />
            <span className="text-zinc-400 text-xs font-mono">Connecting to Spotify...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex gap-0.5 items-end h-4">
              {[3, 5, 4, 6, 3].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 bg-neon-green rounded-full transition-all ${isPaused ? 'opacity-30' : 'animate-pulse'}`}
                  style={{ height: `${h * 3}px`, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-neon-green text-xs font-mono">
              {isPaused ? 'Paused' : 'Playing via Spotify'}
            </span>
          </div>
        )}
      </div>

      <ChaosSyncOverlay isSyncing={isSyncing} />
    </div>
  )
}
