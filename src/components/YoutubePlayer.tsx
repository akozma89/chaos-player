'use client'

import { useEffect, useRef } from 'react'
import { loadYouTubeIframeAPI, YT_STATES } from '../lib/youtubeIframe'

interface YoutubePlayerProps {
  videoId: string
  isHost: boolean
  onEnded?: () => void
  onSkip?: () => void
}

export function YoutubePlayer({ videoId, isHost, onEnded, onSkip }: YoutubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Listen for custom yt-state-change events (used in tests + internal dispatch)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handler = (e: Event) => {
      const state = (e as CustomEvent<{ state: number }>).detail?.state
      if (state === YT_STATES.ENDED && onEnded) {
        onEnded()
      }
    }

    container.addEventListener('yt-state-change', handler)
    return () => container.removeEventListener('yt-state-change', handler)
  }, [onEnded])

  // Load real IFrame player in browser
  useEffect(() => {
    if (typeof window === 'undefined') return

    let player: InstanceType<typeof window.YT.Player> | null = null

    loadYouTubeIframeAPI().then(() => {
      if (!window.YT?.Player) return
      player = new window.YT.Player('yt-player', {
        videoId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
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
      player?.destroy()
    }
  }, [videoId])

  return (
    <div
      ref={containerRef}
      data-testid="yt-player-container"
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden"
    >
      <div id="yt-player" className="w-full h-full" />

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
