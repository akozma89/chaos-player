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
      className="fixed bottom-8 right-8 z-50 flex items-center gap-4 px-6 py-4 rounded-xl border border-neon-green/50 bg-black/90 shadow-[0_0_20px_rgba(52,211,153,0.3)] animate-bounce-in"
    >
      <div className="flex flex-col">
        <span className="text-neon-green font-black text-xs uppercase tracking-widest">Next Winner:</span>
        <span className="text-white font-bold text-lg leading-tight">{winner.title}</span>
        <span className="text-gray-400 text-xs mt-1">Requested by a contributor</span>
      </div>
      <button
        onClick={onDismiss}
        className="ml-4 text-gray-500 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
