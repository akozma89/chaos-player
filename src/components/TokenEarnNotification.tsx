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
    <div className="fixed bottom-4 left-4 right-4 sm:bottom-8 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:min-w-[280px] z-50 animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-zinc-900 border-2 border-neon-green/40 px-3 sm:px-6 py-2 sm:py-4 rounded-2xl shadow-[0_0_30px_rgba(57,255,20,0.2)] flex items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neon-green/20 rounded-full flex items-center justify-center shrink-0">
          <span className="text-xl sm:text-2xl">💎</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-neon-green font-bold text-base sm:text-lg leading-tight">+{amount} Tokens</p>
          <h3 className="text-white font-bold text-xs sm:text-sm tracking-tight">Crowd Pleaser!</h3>
          <p className="text-zinc-400 text-[10px] sm:text-xs truncate">
            {isSelf ? "Your track is a hit!" : "Someone's track is a hit!"}
          </p>
        </div>
      </div>
    </div>
  )
}
