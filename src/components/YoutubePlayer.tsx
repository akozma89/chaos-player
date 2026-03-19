'use client'

import { useEffect, useRef } from 'react'
import { loadYouTubeIframeAPI, YT_STATES, type YTPlayer } from '../lib/youtubeIframe'

interface YoutubePlayerProps {
  videoId: string
  isHost: boolean
  playingSince?: string | null
  onEnded?: () => void
  onSkip?: () => void
}

export function YoutubePlayer({ videoId, isHost, playingSince, onEnded, onSkip }: YoutubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerTargetRef = useRef<HTMLDivElement>(null)

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
              // Video is now playing — unMute via postMessage (YouTube IFrame API),
              // NOT via element.muted which is blocked by the browser autoplay policy
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
    })

    return () => {
      active = false
      player?.destroy()
    }
  }, [videoId, playingSince])

  return (
    <div
      ref={containerRef}
      data-testid="yt-player-container"
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden"
    >
      <div ref={playerTargetRef} className="w-full h-full" />
      {/* Transparent overlay blocks all iframe interaction */}
      <div className="absolute inset-0" style={{ pointerEvents: 'all' }} />

      {isHost && (
        <button
          data-testid="host-skip-btn"
          onClick={onSkip}
          className="absolute bottom-3 right-3 px-3 py-1 bg-neon-pink text-black text-xs font-bold rounded-full hover:opacity-90 transition"
        >
          Skip ⏭
        </button>
      )}
    </div>
  )
}
