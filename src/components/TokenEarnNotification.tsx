'use client'

import React from 'react'

interface Props {
  amount: number
  userId: string
  currentUserId: string
}

export function TokenEarnNotification({ amount, userId, currentUserId }: Props) {
  const isSelf = userId === currentUserId

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-zinc-900 border-2 border-neon-green/40 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(57,255,20,0.2)] flex items-center gap-4">
        <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center shrink-0">
          <span className="text-2xl">💎</span>
        </div>
        <div className="min-w-0">
          <p className="text-neon-green font-bold text-lg leading-tight">+{amount} Tokens</p>
          <h3 className="text-white font-bold text-sm tracking-tight">Crowd Pleaser!</h3>
          <p className="text-zinc-400 text-xs truncate">
            {isSelf ? "Your track is a hit!" : "Someone's track is a hit!"}
          </p>
        </div>
      </div>
    </div>
  )
}
