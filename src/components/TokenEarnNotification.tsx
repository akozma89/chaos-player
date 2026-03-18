'use client'

import React from 'react'

interface TokenEarnNotificationProps {
  username: string
  tokensEarned: number
  trackTitle: string
  onDismiss: () => void
}

export function TokenEarnNotification({
  username,
  tokensEarned,
  trackTitle,
  onDismiss,
}: TokenEarnNotificationProps) {
  return (
    <div
      role="alert"
      data-testid="token-earn-notification"
      className="fixed bottom-8 left-8 z-50 flex items-center gap-4 px-6 py-4 rounded-xl border border-neon-green/60 bg-black/90 shadow-[0_0_24px_rgba(52,211,153,0.4)] animate-bounce-in"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-neon-green font-black text-xs uppercase tracking-widest">
          Crowd Pleaser
        </span>
        <span className="text-white font-bold text-base leading-tight">{trackTitle}</span>
        <span className="text-gray-400 text-xs">
          {username} earns{' '}
          <span className="text-neon-green font-bold">+{tokensEarned}</span> tokens
        </span>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-4 text-gray-500 hover:text-neon-green transition-colors text-lg"
      >
        ✕
      </button>
    </div>
  )
}
