'use client'

import React from 'react'
import type { QueueItem } from '../types'

interface WinnerToastProps {
  winner: QueueItem
  onDismiss: () => void
}

export function WinnerToast({ winner, onDismiss }: WinnerToastProps) {
  return (
    <div
      role="alert"
      data-testid="winner-toast"
      className="fixed top-4 left-4 right-4 sm:top-8 sm:left-auto sm:right-8 sm:w-80 z-[60] flex items-start gap-2 px-4 py-3 sm:px-6 sm:py-4 rounded-xl border border-neon-green/50 bg-black/90 shadow-[0_0_20px_rgba(52,211,153,0.3)] animate-bounce-in backdrop-blur-md"
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-neon-green font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] mb-1">Coming Up Next:</span>
        <span className="text-white font-bold text-sm sm:text-lg leading-tight truncate">{winner.title}</span>
        <span className="text-zinc-400 text-xs mt-1 font-medium truncate">
          Requested by <span className="text-neon-cyan">{winner.addedByName}</span>
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:text-white transition-colors border border-white/10 flex-shrink-0 text-xs sm:text-base"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
