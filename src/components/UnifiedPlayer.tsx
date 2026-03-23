'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Image from 'next/image'
import { YoutubePlayer } from './YoutubePlayer'
import { SpotifyPlayer } from './SpotifyPlayer'
import { advanceQueue, skipQueue, pickNextTrack } from '../lib/autoAdvance'
import { requestHostSkip } from '../lib/moderation'
import { toggleRoomPause } from '../lib/queue'
import type { QueueItem, Room } from '../types'

interface UnifiedPlayerProps {
  currentTrack: QueueItem | null
  queue: QueueItem[]
  room: Room | null
  isHost: boolean
  userId: string
  isSyncing?: boolean
  skipVotes?: string[]
  activeSessionCount?: number
  onVoteSkip?: (queueItemId: string) => void
  onTrackChange?: (next: QueueItem | null) => void
  onTokenSkip?: () => void
}

export function UnifiedPlayer({
  currentTrack,
  queue,
  room,
  isHost,
  userId,
  isSyncing = false,
  skipVotes = [],
  activeSessionCount = 1,
  onVoteSkip,
  onTrackChange,
  onTokenSkip,
}: UnifiedPlayerProps) {
  const [elapsed, setElapsed] = useState(0)
  const [showVideo, setShowVideo] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [pausedElapsed, setPausedElapsed] = useState<number | null>(null)
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === 'undefined') return 100
    const stored = localStorage.getItem('chaos-player-volume')
    const parsed = stored !== null ? Number(stored) : NaN
    return isNaN(parsed) ? 100 : Math.min(100, Math.max(0, parsed))
  })
  const [prevVolume, setPrevVolume] = useState(100)

  const applyVolume = (v: number) => {
    setVolume(v)
    localStorage.setItem('chaos-player-volume', String(v))
  }

  const handleToggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume)
      applyVolume(0)
    } else {
      applyVolume(prevVolume || 100)
    }
  }

  const isPaused = room?.isPaused ?? false

  // Track previous playingSince to detect when database updates during unpause
  const prevPlayingSinceRef = useRef<string | null | undefined>(currentTrack?.playingSince)

  // Track pause state transitions to preserve paused position
  useEffect(() => {
    if (isPaused && !pausedElapsed && elapsed > 0) {
      // When pausing, save the current elapsed time
      setPausedElapsed(elapsed)
    } else if (!isPaused && pausedElapsed !== null) {
      // When unpausing, keep the saved paused position until playingSince changes
      // (indicating database has updated with adjusted value)
      if (currentTrack?.playingSince === prevPlayingSinceRef.current) {
        // playingSince hasn't changed yet, keep paused position
        return
      }
      // playingSince has changed, clear paused position and use live calculation
      setPausedElapsed(null)
    }
  }, [isPaused, elapsed, pausedElapsed, currentTrack?.playingSince])

  // Update ref to track playingSince changes
  useEffect(() => {
    prevPlayingSinceRef.current = currentTrack?.playingSince
  }, [currentTrack?.playingSince])

  // Sync elapsed time based on room pause state
  // Properties of currentTrack are used, not the object itself, so we track those
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!currentTrack) {
      setElapsed(0)
      setPausedElapsed(null)
      return
    }

    const calculateElapsed = () => {
      if (isPaused) {
        // While paused, use the saved paused position or calculate from database values
        if (pausedElapsed !== null) {
          return pausedElapsed
        }
        // Fallback: calculate from pausedAt and playingSince if available
        if (room?.pausedAt && currentTrack.playingSince) {
          const elapsed = Math.floor((new Date(room.pausedAt).getTime() - new Date(currentTrack.playingSince).getTime()) / 1000)
          return Math.max(0, Math.min(elapsed, currentTrack.duration))
        }
        return 0
      } else {
        // While playing, position is calculated from current time
        if (!currentTrack.playingSince) return 0
        const elapsed = Math.floor((Date.now() - new Date(currentTrack.playingSince).getTime()) / 1000)
        return Math.max(0, Math.min(elapsed, currentTrack.duration))
      }
    }

    setElapsed(calculateElapsed())

    if (isPaused) return

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
  }, [currentTrack?.id, currentTrack?.playingSince, currentTrack?.duration, isPaused, room?.pausedAt, pausedElapsed])

  const tryAdvance = useCallback(async () => {
    if (!currentTrack) return
    const { nextItem, error } = await advanceQueue({
      currentItemId: currentTrack.id,
      queue,
      roomId: currentTrack.roomId,
    })
    if (error) {
      setAdvanceError(error.message)
      return
    }
    setAdvanceError(null)
    onTrackChange?.(nextItem)
  }, [currentTrack, queue, onTrackChange])

  const trySkip = useCallback(async () => {
    if (!currentTrack) return

    // If only the host is in the room, skip instantly (no one to veto)
    if (activeSessionCount <= 1) {
      const { nextItem, error } = await skipQueue({
        currentItemId: currentTrack.id,
        queue,
        roomId: currentTrack.roomId,
      })
      if (error) {
        setAdvanceError(error.message)
        return
      }
      setAdvanceError(null)
      onTrackChange?.(nextItem)
      return
    }

    // Otherwise, host skip creates a veto window (30s) for other users to vote
    const { error } = await requestHostSkip({
      roomId: currentTrack.roomId,
      queueItemId: currentTrack.id,
      hostId: userId,
      durationMs: 30000,
    })
    if (error) {
      setAdvanceError(error.message)
      return
    }
    setAdvanceError(null)
    onTrackChange?.(null)
  }, [currentTrack, userId, queue, activeSessionCount, onTrackChange])

  const handleTogglePause = async () => {
    if (!room) return
    const { error } = await toggleRoomPause(room.id, !isPaused)
    if (error) {
      setAdvanceError(error.message)
    }
  }

  const nextWinner = useMemo(() => pickNextTrack(queue), [queue])
  const remainingTime = currentTrack ? currentTrack.duration - elapsed : 0
  const showCountdown = remainingTime > 0 && remainingTime <= 10 && nextWinner && !isPaused

  const hasVotedSkip = currentTrack ? skipVotes.includes(userId) : false
  const skipVotesNeeded = Math.min(room?.skipVoteCount || 2, activeSessionCount || 1)
  const currentSkipVotes = skipVotes.length

  if (!currentTrack) {
    return (
      <div className="flex items-center z-[100] p-6 justify-center h-64 bg-zinc-900 rounded-3xl border border-white/5 text-zinc-500 font-mono text-sm tracking-widest uppercase animate-pulse">
        Waiting for democracy to pick a track...
      </div>
    )
  }

  const progressPct = currentTrack.duration > 0
    ? (elapsed / currentTrack.duration) * 100
    : 0

  const fmtTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = Math.floor(s % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-zinc-900/40 rounded-[2rem] border border-white/10 backdrop-blur-md shadow-2xl relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-neon-purple/10 blur-[100px] rounded-full" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-neon-cyan/10 blur-[100px] rounded-full" />

      {/* YouTube: always mounted for initialization, visually toggled with showVideo */}
      {currentTrack.source === 'youtube' && (
        <div className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5 mb-2 transition-all ${!showVideo ? 'h-0 opacity-0 absolute' : ''}`}>
          <YoutubePlayer
            key={currentTrack.id}
            videoId={currentTrack.sourceId}
            playingSince={currentTrack.playingSince}
            pausedAt={room?.pausedAt ?? null}
            isSyncing={isSyncing}
            isPaused={isPaused}
            volume={volume}
            onEnded={tryAdvance}
          />
        </div>
      )}

      {/* Spotify: audio-only player, always mounted while track is active */}
      {currentTrack.source === 'spotify' && (
        <SpotifyPlayer
          key={currentTrack.id}
          trackId={currentTrack.sourceId}
          playingSince={currentTrack.playingSince}
          pausedAt={room?.pausedAt ?? null}
          isSyncing={isSyncing}
          isPaused={isPaused}
          volume={volume}
          onEnded={tryAdvance}
        />
      )}

      {/* Main Player UI */}
      <div className="flex flex-col gap-4 z-10">
        {/* Top row: Artwork + Track Info */}
        <div className="flex items-center gap-4">
        {/* Artwork Placeholder / Source Icon */}
        <div className="relative flex-shrink-0 group/artwork">
          <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500 overflow-hidden relative">
             {currentTrack.thumbnailUrl ? (
                <Image
                  src={currentTrack.thumbnailUrl}
                  alt={currentTrack.title}
                  fill
                  sizes="(max-width: 768px) 96px, 128px"
                  className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
             ) : (
                currentTrack.source === 'youtube' ? (
                  <span className="text-4xl">🔴</span>
                ) : (
                  <span className="text-4xl text-neon-green">🎧</span>
                )
             )}
             
             {/* Integrated Source Badge */}
             <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                {currentTrack.source === 'youtube' ? (
                  <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.016 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-neon-green fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                )}
             </div>

             <div className="absolute inset-0 bg-neon-purple/5 group-hover:bg-neon-purple/20 transition-colors" />
          </div>
          {/* Pause Overlay (Only if paused) */}
          {isPaused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl backdrop-blur-[2px]">
              <svg className="w-10 h-10 text-white fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white truncate tracking-tight group-hover:text-neon-cyan transition-colors duration-500" title={currentTrack.title}>
            {currentTrack.title}
          </h2>
          <p className="text-zinc-400 font-medium text-sm sm:text-lg truncate" title={currentTrack.artist}>
            {currentTrack.artist}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Added by {currentTrack.addedByName}
              </span>
            </div>
          </div>
        </div>
        </div>{/* end top row */}

        {/* Controls Row */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              data-testid="mute-btn"
              className="p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : volume < 50 ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => applyVolume(Number(e.target.value))}
              data-testid="volume-slider"
              className="w-16 sm:w-24 accent-neon-cyan cursor-pointer"
              aria-label="Volume"
            />
          </div>

          {currentTrack.source === 'youtube' && (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className={`p-3 rounded-full border transition-all duration-300 ${
                showVideo
                  ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
              }`}
              title={showVideo ? 'Hide Video' : 'Show Video'}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          {isHost && (
            <button
              onClick={handleTogglePause}
              className="p-4 rounded-full bg-white text-black hover:scale-110 transition-transform active:scale-95 shadow-xl"
            >
              {isPaused ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )}
            </button>
          )}

          {/* Host Propose Skip / Guest Token Skip */}
          {(isHost || onTokenSkip) && (
            <button
              onClick={isHost ? trySkip : onTokenSkip}
              title={isHost ? 'Propose skip (30s veto window)' : 'Use tokens to force skip'}
              className={`group/skip relative p-3 rounded-full border border-white/10 bg-white/5 hover:bg-neon-pink/10 hover:border-neon-pink/30 transition-all ${
                !isHost && 'hover:shadow-[0_0_20px_rgba(255,16,240,0.2)]'
              }`}
            >
              <svg className="w-6 h-6 text-zinc-400 group-hover/skip:text-neon-pink transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              {!isHost && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-neon-pink text-[10px] font-black rounded opacity-0 group-hover/skip:opacity-100 transition-opacity whitespace-nowrap">
                  FORCE 5🪙
                </span>
              )}
            </button>
          )}

          {/* Guest Vote Skip */}
          {!isHost && onVoteSkip && (
            <button
              onClick={() => onVoteSkip(currentTrack.id)}
              className={`relative px-4 py-2 rounded-full border text-sm font-bold transition-all ${
                hasVotedSkip 
                  ? 'bg-neon-pink text-black border-neon-pink shadow-[0_0_15px_rgba(255,16,240,0.4)]' 
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/10'
              }`}
            >
              SKIP ({currentSkipVotes}/{skipVotesNeeded})
            </button>
          )}
        </div>
      </div>

      {/* Progress & Countdown Area */}
      <div className="space-y-3 z-10">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Progress</span>
            <span className="text-sm font-mono text-zinc-300">{fmtTime(elapsed)}</span>
          </div>
          
          {showCountdown && (
            <div className="flex items-center gap-3 px-4 py-1.5 bg-neon-purple/20 border border-neon-purple/40 rounded-full animate-pulse">
               <span className="text-[10px] font-black text-neon-purple uppercase tracking-widest">Next Up</span>
               <span className="text-xs font-bold text-white truncate max-w-[120px]">{nextWinner.title}</span>
               <span className="text-sm font-black text-neon-purple">{remainingTime}s</span>
            </div>
          )}

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Duration</span>
            <span className="text-sm font-mono text-zinc-300">{fmtTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Improved Progress Bar */}
        <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-neon-purple via-neon-cyan to-neon-purple bg-[length:200%_auto] animate-shimmer transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(0,255,255,0.4)]"
            style={{ width: `${progressPct}%` }}
          />
          {/* Subtle Glow on the tip */}
          <div 
            className="absolute top-0 h-full w-4 bg-white/40 blur-sm transition-all duration-1000 ease-linear"
            style={{ left: `calc(${progressPct}% - 8px)` }}
          />
        </div>
      </div>

      {/* Error Overlay */}
      {advanceError && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center justify-between">
          <p className="text-xs text-red-400 font-medium">Advance Error: {advanceError}</p>
          <button onClick={() => setAdvanceError(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .animate-shimmer {
          animation: shimmer 5s linear infinite;
        }
      `}</style>
    </div>
  )
}
