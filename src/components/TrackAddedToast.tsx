'use client'

import React from 'react'
import type { QueueItem } from '../types'
import { VoteButton } from './VoteButton'

interface TrackAddedToastProps {
  track: QueueItem
  userVote?: 'upvote' | 'downvote'
  onVote: (type: 'upvote' | 'downvote') => void
  onDismiss: () => void
}

export function TrackAddedToast({ track, userVote, onVote, onDismiss }: TrackAddedToastProps) {
  return (
    <div
      role="alert"
      data-testid="track-added-toast"
      className="flex items-center gap-4 px-6 py-4 rounded-xl border border-neon-blue/50 bg-black/90 shadow-[0_0_20px_rgba(0,195,255,0.3)] animate-bounce-in backdrop-blur-md"
    >
      <div className="flex flex-col flex-1 mr-2">
        <span className="text-neon-blue font-black text-[10px] uppercase tracking-[0.2em] mb-1">Track Added:</span>
        <span className="text-white font-bold text-lg leading-tight truncate max-w-[200px] sm:max-w-xs">{track.title}</span>
        <span className="text-zinc-400 text-xs mt-1 font-medium truncate max-w-[200px] sm:max-w-xs">
          Added by <span className="text-neon-pink">{track.addedByName || 'Chaos'}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 border-l border-white/10 pl-4 border-r pr-4">
        <VoteButton
          type="upvote"
          count={track.upvotes}
          active={userVote === 'upvote'}
          onClick={() => onVote('upvote')}
        />
        <VoteButton
          type="downvote"
          count={track.downvotes}
          active={userVote === 'downvote'}
          onClick={() => onVote('downvote')}
        />
      </div>

      <button
        onClick={onDismiss}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:text-white transition-colors border border-white/10 shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

