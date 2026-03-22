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
      className="fixed top-8 right-8 z-[60] flex items-center gap-4 px-6 py-4 rounded-xl border border-neon-green/50 bg-black/90 shadow-[0_0_20px_rgba(52,211,153,0.3)] animate-bounce-in backdrop-blur-md"
    >
      <div className="flex flex-col">
        <span className="text-neon-green font-black text-[10px] uppercase tracking-[0.2em] mb-1">Coming Up Next:</span>
        <span className="text-white font-bold text-lg leading-tight">{winner.title}</span>
        <span className="text-zinc-400 text-xs mt-1 font-medium">
          Requested by <span className="text-neon-cyan">{winner.addedByName}</span>
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="ml-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:text-white transition-colors border border-white/10"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
