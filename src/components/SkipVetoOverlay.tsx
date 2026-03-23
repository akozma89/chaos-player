'use client'

import React, { useState, useEffect } from 'react'

interface SkipVetoOverlayProps {
  requestId: string;
  expiresAt: string;
  vetoCount: number;
  vetoThreshold: number;
  activeSessionCount: number;
  onVeto: () => void;
  isVetoedByUser: boolean;
  isHost: boolean;
}

export default function SkipVetoOverlay({
  requestId,
  expiresAt,
  vetoCount,
  vetoThreshold,
  activeSessionCount,
  onVeto,
  isVetoedByUser,
  isHost,
}: SkipVetoOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!requestId) return

    const updateTimer = () => {
      const now = Date.now()
      const end = new Date(expiresAt).getTime()
      const diff = Math.max(0, Math.floor((end - now) / 1000))
      setTimeLeft(diff)
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [requestId, expiresAt])

  if (!requestId || timeLeft <= 0) return null

  const thresholdCount = Math.ceil((activeSessionCount * vetoThreshold) / 100)
  const progress = Math.min(100, (vetoCount / thresholdCount) * 100)

  return (
    <div 
      data-testid="skip-veto-overlay"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md border-4 border-neon-magenta/20 animate-pulse"
    >
      <div className="bg-zinc-900/90 p-8 rounded-2xl border-2 border-neon-magenta shadow-[0_0_30px_rgba(255,0,255,0.3)] max-w-sm w-full space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-neon-magenta uppercase tracking-tighter italic drop-shadow-[0_0_8px_rgba(255,0,255,0.5)]">
            Host requested a skip
          </h2>
          <p className="text-zinc-400 text-sm font-medium">
            The community has {`${timeLeft}s`} to veto this skip.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest">
            <span>Veto Progress</span>
            <span className="text-neon-magenta font-bold">{vetoCount} / {thresholdCount} vetoes</span>
          </div>
          <div className="h-4 bg-zinc-800 rounded-full overflow-hidden p-1 border border-zinc-700">
            <div 
              className="h-full bg-gradient-to-r from-neon-magenta to-magenta-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(255,0,255,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={onVeto}
          disabled={isVetoedByUser || isHost}
          className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all duration-300 transform hover:scale-105 active:scale-95 ${
            isVetoedByUser || isHost
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border-zinc-700'
              : 'bg-transparent text-neon-magenta border-2 border-neon-magenta hover:bg-neon-magenta/10 shadow-[0_0_15px_rgba(255,0,255,0.2)]'
          }`}
        >
          {isVetoedByUser ? 'Veto Cast' : isHost ? 'Host cannot veto' : 'Veto Skip'}
        </button>
        
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em]">
          Democracy requires vigilance
        </p>
      </div>
    </div>
  )
}
