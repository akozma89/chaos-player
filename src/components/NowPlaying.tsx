'use client'

import { useEffect, useState, useCallback } from 'react'
import { YoutubePlayer } from './YoutubePlayer'
import { advanceQueue } from '../lib/autoAdvance'
import type { QueueItem } from '../types'

interface NowPlayingProps {
  currentTrack: QueueItem | null
  queue: QueueItem[]
  isHost: boolean
  userId: string
  onTrackChange?: (next: QueueItem | null) => void
  onTokenSkip?: () => void
}

export function NowPlaying({
  currentTrack,
  queue,
  isHost,
  userId: _userId,
  onTrackChange,
  onTokenSkip,
}: NowPlayingProps) {
  const [elapsed, setElapsed] = useState(0)

  // Reset timer when track changes
  useEffect(() => {
    setElapsed(0)
    if (!currentTrack) return

    const interval = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= currentTrack.duration) {
          clearInterval(interval)
          return currentTrack.duration
        }
        return prev + 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentTrack])

  const handleEnded = useCallback(async () => {
    if (!currentTrack) return
    const { nextItem } = await advanceQueue({
      currentItemId: currentTrack.id,
      queue,
      roomId: currentTrack.roomId,
    })
    onTrackChange?.(nextItem)
  }, [currentTrack, queue, onTrackChange])

  const handleHostSkip = useCallback(async () => {
    if (!currentTrack) return
    const { nextItem } = await advanceQueue({
      currentItemId: currentTrack.id,
      queue,
      roomId: currentTrack.roomId,
    })
    onTrackChange?.(nextItem)
  }, [currentTrack, queue, onTrackChange])

  if (!currentTrack) {
    return (
      <div
        data-testid="now-playing-empty"
        className="flex items-center justify-center h-48 text-gray-500 text-sm"
      >
        Queue is empty — add a track to get started
      </div>
    )
  }

  const progressPct = currentTrack.duration > 0
    ? Math.round((elapsed / currentTrack.duration) * 100)
    : 0

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div data-testid="now-playing" className="flex flex-col gap-3">
      <YoutubePlayer
        videoId={currentTrack.videoId}
        isHost={isHost}
        onEnded={handleEnded}
        onSkip={handleHostSkip}
      />

      {/* Track info */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-white font-semibold truncate text-sm leading-tight">
            {currentTrack.title}
          </p>
          <p className="text-gray-400 text-xs truncate">{currentTrack.artist}</p>
        </div>

        {/* Token skip CTA for non-hosts */}
        {!isHost && onTokenSkip && (
          <button
            data-testid="token-skip-btn"
            onClick={onTokenSkip}
            className="ml-3 shrink-0 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-full transition"
          >
            Skip (5🪙)
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>{fmtTime(elapsed)}</span>
        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            data-testid="progress-bar"
            className="h-full bg-violet-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span>{fmtTime(currentTrack.duration)}</span>
      </div>
    </div>
  )
}
