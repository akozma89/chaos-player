'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { YoutubePlayer } from './YoutubePlayer'
import { advanceQueue, pickNextTrack } from '../lib/autoAdvance'
import type { QueueItem } from '../types'

function AdvanceError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      data-testid="now-playing-error"
      className="flex items-start gap-3 px-4 py-3 rounded-lg border border-pink-500 bg-black/80 text-sm"
    >
      <span className="text-pink-500 font-bold leading-none mt-0.5" aria-hidden>
        ⚠
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-pink-500 font-bold">Queue Advance Failed</p>
        <p className="text-gray-300 mt-0.5">{message}</p>
      </div>
      <button
        data-testid="now-playing-error-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-gray-500 hover:text-white transition shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

interface NowPlayingProps {
  currentTrack: QueueItem | null
  queue: QueueItem[]
  isHost: boolean
  userId: string
  isSyncing?: boolean
  onTrackChange?: (next: QueueItem | null) => void
  onTokenSkip?: () => void
}

export function NowPlaying({
  currentTrack,
  queue,
  isHost,
  userId: _userId,
  isSyncing = false,
  onTrackChange,
  onTokenSkip,
}: NowPlayingProps) {
  const [elapsed, setElapsed] = useState(0)
  const [advanceError, setAdvanceError] = useState<string | null>(null)

  // Reset timer when track changes; start from current offset to stay in sync
  useEffect(() => {
    if (!currentTrack) {
      setElapsed(0)
      return
    }

    const initialOffset = currentTrack.playingSince
      ? Math.min(
          Math.floor((Date.now() - new Date(currentTrack.playingSince).getTime()) / 1000),
          currentTrack.duration
        )
      : 0
    setElapsed(initialOffset)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id])

  const tryAdvance = useCallback(async () => {
    if (!currentTrack) return
    const { nextItem, error } = await advanceQueue({
      currentItemId: currentTrack.id,
      queue,
      roomId: currentTrack.roomId,
    })
    if (error) {
      // Rollback: do not call onTrackChange, surface error to user
      setAdvanceError(error.message)
      return
    }
    setAdvanceError(null)
    onTrackChange?.(nextItem)
  }, [currentTrack, queue, onTrackChange])

  const nextWinner = useMemo(() => pickNextTrack(queue), [queue])
  const remainingTime = currentTrack ? currentTrack.duration - elapsed : 0
  const showCountdown = remainingTime > 0 && remainingTime <= 10 && nextWinner

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
      {currentTrack.source === 'youtube' ? (
        <YoutubePlayer
          key={currentTrack.sourceId}
          videoId={currentTrack.sourceId}
          playingSince={currentTrack.playingSince}
          isSyncing={isSyncing}
          onEnded={tryAdvance}
        />
      ) : (
        <div className="bg-zinc-800 aspect-video flex items-center justify-center rounded-lg border border-white/10">
          <p className="text-zinc-500 text-sm">Spotify playback not yet implemented</p>
        </div>
      )}

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

      {/* Next Up Winner Countdown */}
      {showCountdown && (
        <div className="flex items-center justify-between px-3 py-2 bg-violet-900/40 border border-violet-500/50 rounded animate-pulse shadow-[0_0_15px_rgba(139,92,246,0.3)]">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Next Up:</span>
            <span className="text-white text-xs font-medium truncate">{nextWinner.title}</span>
          </div>
          <div className="flex flex-col items-center">
             <span className="text-violet-400 font-black text-lg leading-none">{remainingTime}s</span>
             <span className="text-[8px] text-violet-300/70 uppercase">Winning</span>
          </div>
        </div>
      )}

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

      {/* Advance error toast (optimistic rollback) */}
      {advanceError && (
        <AdvanceError message={advanceError} onDismiss={() => setAdvanceError(null)} />
      )}
    </div>
  )
}
