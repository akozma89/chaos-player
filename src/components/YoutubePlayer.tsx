'use client'

import { useEffect, useRef, useState } from 'react'
import { loadYouTubeIframeAPI, YT_STATES, type YTPlayer } from '../lib/youtubeIframe'
import ChaosSyncOverlay from './ChaosSyncOverlay'

const DEBUG = typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('debug') === 'player'

// Log immediately on module load to verify DEBUG is working
if (typeof window !== 'undefined') {
  const debugParam = new URL(window.location.href).searchParams.get('debug')
  if (debugParam === 'player') {
    console.log('🎬 YoutubePlayer DEBUG MODE ENABLED')
  }
}

const log = (label: string, data?: any) => {
  if (DEBUG) {
    const now = new Date()
    const ms = String(now.getMilliseconds()).padStart(3, '0')
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${ms}`
    console.log(`[${timestamp}] 🎬 ${label}`, data ?? '')
  }
}

interface YoutubePlayerProps {
  videoId: string
  playingSince?: string | null
  pausedAt?: string | null
  isSyncing?: boolean
  isPaused?: boolean
  volume?: number
  onEnded?: () => void
}

export function YoutubePlayer({
  videoId,
  playingSince,
  pausedAt,
  isSyncing = false,
  isPaused = false,
  volume = 100,
  onEnded
}: YoutubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerTargetRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Track seeking per video
  const lastSeekedVideoId = useRef<string | null>(null)

  // Keep a ref so the onStateChange closure always reads the latest volume
  const volumeRef = useRef(volume)
  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  // Track when pause state last changed to avoid Resume Stutter
  // (seeking immediately after playVideo() can cause the player to reset)
  const lastPauseChangeRef = useRef<number>(0)

  // Track current pause state for onStateChange handler to avoid stale closure
  // (onStateChange closes over the isPaused value when player is created, which becomes stale)
  const isPausedRef = useRef(isPaused)
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // 4. Volume synchronization
  useEffect(() => {
    if (!isReady || !playerRef.current) return
    if (volume === 0) {
      playerRef.current.mute()
    } else {
      playerRef.current.unMute()
      playerRef.current.setVolume(volume)
    }
  }, [volume, isReady])



  // 1. Core Playback Synchronization
  // This effect handles the play/pause command whenever the isPaused prop changes.
  useEffect(() => {
    log(`isPaused effect dependency change: isPaused=${isPaused}, isReady=${isReady}, playerRef=${!!playerRef.current}`)

    if (!isReady || !playerRef.current) {
      log(`  → Early return: isReady=${isReady}, playerRef=${!!playerRef.current}`)
      return
    }

    // Record when pause state changes to coordinate with seek effect
    lastPauseChangeRef.current = Date.now()

    const player = playerRef.current
    const state = player.getPlayerState()
    const stateNames: Record<number, string> = { [-1]: 'UNSTARTED', 0: 'ENDED', 1: 'PLAYING', 2: 'PAUSED', 3: 'BUFFERING', 5: 'CUED' }

    log(`isPaused effect executing: isPaused=${isPaused}, currentState=${stateNames[state]}`)

    if (isPaused) {
      if (state !== YT_STATES.PAUSED && state !== YT_STATES.BUFFERING && state !== YT_STATES.CUED) {
        // Use exact server logic for cue to prevent local latency accumulation
        let perfectTime = player.getCurrentTime()
        if (pausedAt && playingSince) {
          perfectTime = (new Date(pausedAt).getTime() - new Date(playingSince).getTime()) / 1000
        }
        log(`⏸️  Calling cueVideoById at perfectTime=${perfectTime.toFixed(2)}s`)
        player.cueVideoById({
          videoId: videoId,
          startSeconds: Math.max(0, perfectTime),
          endSeconds: 999999
        })
      }
    } else {
      // If we are supposed to be playing
      if (state === YT_STATES.PAUSED || state === YT_STATES.CUED || state === YT_STATES.UNSTARTED) {
        log(`▶️  Calling playVideo()`)
        // Resync exact network offset upon unpausing to prevent any latency drag
        if (playingSince) {
          const expectedTime = (Date.now() - new Date(playingSince).getTime()) / 1000
          player.seekTo(Math.max(0, expectedTime), true)
        }
        // Mute to ensure programmatic play succeeds
        player.mute()
        player.setVolume(0)
        player.playVideo()
      }
    }
  }, [isPaused, isReady, videoId, pausedAt, playingSince])

  // 2. Time Synchronization (Seek)
  // This effect handles jumping to the correct time when:
  // - A new video starts
  // - A user joins mid-track
  // - The host unpauses (which shifts playingSince)
  useEffect(() => {
    if (!isReady || !playerRef.current || !playingSince || isPaused) return

    const player = playerRef.current
    const expectedTime = (Date.now() - new Date(playingSince).getTime()) / 1000
    const actualTime = player.getCurrentTime()

    const isNewVideo = lastSeekedVideoId.current !== videoId
    const drift = Math.abs(expectedTime - actualTime)

    // Skip seeking for 500ms after pause state changes to avoid Resume Stutter.
    // When unpausing, playVideo() is called first, then we settle into playback before syncing time.
    // Seeking immediately after playVideo() can cause the player to reset or pause briefly.
    const timeSincePauseChange = Date.now() - lastPauseChangeRef.current
    if (timeSincePauseChange < 500) {
      log(`⏳ Skipping seek (${timeSincePauseChange}ms since pause change < 500ms)`)
      return
    }

    log(`Time sync check: expected=${expectedTime.toFixed(2)}s, actual=${actualTime.toFixed(2)}s, drift=${drift.toFixed(2)}s, isNewVideo=${isNewVideo}`)

    // Seek if it's a new video or if we've drifted significantly (> 2s)
    if (isNewVideo || drift > 2) {
      log(`🎯 Seeking to ${expectedTime.toFixed(2)}s (drift: ${drift.toFixed(2)}s)`)
      player.seekTo(expectedTime, true)
      lastSeekedVideoId.current = videoId

      // If we seeked while unpaused, ensure it's playing
      if (!isPaused && player.getPlayerState() !== YT_STATES.PLAYING) {
        log(`⚠️  Ensuring playback after seek`)
        player.mute()
        player.setVolume(0)
        player.playVideo()
      }
    }
  }, [playingSince, videoId, isReady, isPaused])

  // 3. Lifecycle & Initialization
  // Only re-create player when video changes, not on prop changes (other effects handle those)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof window === 'undefined' || !playerTargetRef.current) return

    log(`Initializing new player for videoId=${videoId}`)

    let player: YTPlayer | null = null
    let active = true

    loadYouTubeIframeAPI().then(() => {
      log(`YouTube API loaded, active=${active}, YT.Player=${!!window.YT?.Player}, playerTargetRef=${!!playerTargetRef.current}`)
      if (!active || !window.YT?.Player || !playerTargetRef.current) {
        log(`⚠️  Skipping player creation: active=${active}, YT.Player=${!!window.YT?.Player}, playerTargetRef=${!!playerTargetRef.current}`)
        return
      }

      log(`Creating YouTube Player instance for ${videoId}`)

      player = new window.YT.Player(playerTargetRef.current, {
        videoId,
        playerVars: {
          autoplay: isPaused ? 0 : 1,
          mute: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 0,
          enablejsapi: 1
        },
        events: {
          onReady: (event) => {
            const p = event.target

            log(`🎮 onReady fired, isPaused=${isPaused}`)

            // Start muted to bypass autoplay restrictions, then unmute on PLAYING via onStateChange
            p.mute()
            p.setVolume(0)

            // Perform initial seek and calculate offset for cueVideoById
            let offset = 0
            if (playingSince) {
              if (isPaused && pausedAt) {
                // If paused, seek to the position it was paused at
                offset = (new Date(pausedAt).getTime() - new Date(playingSince).getTime()) / 1000
              } else {
                // If playing, seek to current progress
                offset = (Date.now() - new Date(playingSince).getTime()) / 1000
              }

              log(`Initial seek offset: ${offset.toFixed(2)}s`)

              if (offset > 0.5) {
                p.seekTo(Math.max(0, offset), true)
                lastSeekedVideoId.current = videoId
              }
            }

            // Set initial state (after muting to ensure clean autoplay behavior)
            if (isPaused) {
              log(`onReady: Setting initial state to PAUSED with cueVideoById`)
              // Use cueVideoById instead of pauseVideo to leave player in good state for resume
              p.cueVideoById({
                videoId: videoId,
                startSeconds: Math.max(0, offset),
                endSeconds: 999999
              })
            } else {
              log(`onReady: Setting initial state to PLAYING`)
              p.playVideo()
            }

            setIsReady(true)
          },
          onStateChange: (event) => {
            const stateNames: Record<number, string> = { [-1]: 'UNSTARTED', 0: 'ENDED', 1: 'PLAYING', 2: 'PAUSED', 3: 'BUFFERING', 5: 'CUED' }
            const state = event.data
            const p = event.target



            log(`📊 onStateChange: ${stateNames[state]}, isPausedRef=${isPausedRef.current}`)

            // Unmute once playback successfully starts
            if (state === YT_STATES.PLAYING) {
              if (volumeRef.current === 0) {
                p.mute()
              } else {
                p.unMute()
                p.setVolume(volumeRef.current)
              }

              // Double check pause state using ref (avoid stale closure from initial isPaused)
              if (isPausedRef.current) {
                log(`⚠️  onStateChange PLAYING but isPausedRef=true, calling pauseVideo()`)
                p.pauseVideo()
              }
            }

            // If stopped or paused but we should be playing, resume
            if ((state === YT_STATES.PAUSED || state === YT_STATES.UNSTARTED || state === YT_STATES.CUED) && !isPausedRef.current) {
              log(`⚠️  onStateChange ${stateNames[state]} but isPausedRef=false, resuming with playVideo()`)
              p.mute()
              p.setVolume(0)
              p.playVideo()
            }

            if (state === YT_STATES.ENDED) {
              log(`🏁 Track ended`)
              onEnded?.()
            }
          },
        },
      })
      playerRef.current = player
    })

    return () => {
      log(`Cleaning up player for videoId=${videoId}`)
      active = false
      setIsReady(false)
      player?.destroy()
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  return (
    <div
      ref={containerRef}
      data-testid="yt-player-container"
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5"
    >
      <div ref={playerTargetRef} className="w-full h-full" />

      {/* Transparent overlay blocks all iframe interaction unless debugging */}
      <div className="absolute inset-0 z-10" style={{ pointerEvents: DEBUG ? 'none' : 'all' }} />

      <ChaosSyncOverlay isSyncing={isSyncing} />
    </div>
  )
}
