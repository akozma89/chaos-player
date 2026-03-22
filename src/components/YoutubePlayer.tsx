'use client'

import { useEffect, useRef, useState } from 'react'
import { loadYouTubeIframeAPI, YT_STATES, type YTPlayer } from '../lib/youtubeIframe'
import { AutoplayGuard } from './AutoplayGuard'
import ChaosSyncOverlay from './ChaosSyncOverlay'

interface YoutubePlayerProps {
  videoId: string
  isHost: boolean
  playingSince?: string | null
  isSyncing?: boolean
  onEnded?: () => void
  onSkip?: () => void
}

export function YoutubePlayer({ videoId, isHost, playingSince, isSyncing = false, onEnded, onSkip }: YoutubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerTargetRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)

  // Custom event listener — used by tests and internally to bubble onEnded
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ state: number }>).detail?.state === YT_STATES.ENDED) {
        onEnded?.()
      }
    }
    container.addEventListener('yt-state-change', handler)
    return () => container.removeEventListener('yt-state-change', handler)
  }, [onEnded])

  // IFrame API player lifecycle
  useEffect(() => {
    if (typeof window === 'undefined' || !playerTargetRef.current) return

    let player: YTPlayer | null = null
    let active = true

    loadYouTubeIframeAPI().then(() => {
      if (!active || !window.YT?.Player || !playerTargetRef.current) return

      player = new window.YT.Player(playerTargetRef.current, {
        videoId,
        playerVars: { autoplay: 1, mute: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            // Seek to the correct offset — still muted at this point
            if (playingSince) {
              const offsetSeconds = (Date.now() - new Date(playingSince).getTime()) / 1000
              if (offsetSeconds > 1) player?.seekTo(offsetSeconds)
            }
          },
          onStateChange: (e) => {
            if (e.data === YT_STATES.PLAYING) {
              player?.unMute()
              player?.setVolume(100)
            }
            if (e.data === YT_STATES.ENDED) {
              containerRef.current?.dispatchEvent(
                new CustomEvent('yt-state-change', { detail: { state: YT_STATES.ENDED } })
              )
            }
          },
        },
      })
      playerRef.current = player
    })

    return () => {
      active = false
      player?.destroy()
      playerRef.current = null
    }
  }, [videoId, playingSince])

  const handleEnableAutoplay = () => {
    if (playerRef.current) {
      playerRef.current.unMute()
      playerRef.current.setVolume(100)
      playerRef.current.playVideo()
    }
  }

  return (
    <div
      ref={containerRef}
      data-testid="yt-player-container"
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5"
    >
      <div ref={playerTargetRef} className="w-full h-full" />
      {/* Transparent overlay blocks all iframe interaction */}
      <div className="absolute inset-0 z-10" style={{ pointerEvents: 'all' }} />

      <ChaosSyncOverlay isSyncing={isSyncing} />

      {isHost && (
        <button
          data-testid="host-skip-btn"
          onClick={onSkip}
          className="absolute bottom-3 right-3 z-20 px-4 py-2 bg-neon-pink/10 hover:bg-neon-pink/20 text-neon-pink border border-neon-pink/30 text-xs font-black rounded-full transition-all shadow-[0_0_15px_rgba(255,0,111,0.2)]"
        >
          SKIP TRACK ⏭
        </button>
      )}
    </div>
  )
}
