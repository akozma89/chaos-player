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
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60"
    >
      <div className="bg-zinc-900 p-6 rounded-xl border border-neon-magenta/50 max-w-sm w-full space-y-4 text-center">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-neon-magenta uppercase tracking-wide">
            Host Skip Proposed
          </h2>
          <p className="text-zinc-300 text-sm">
            Users can veto within {`${timeLeft}s`}
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-zinc-400">
            {vetoCount} of {thresholdCount} vetoes needed
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded border border-zinc-700">
            <div
              className="h-full bg-neon-magenta rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={onVeto}
          disabled={isVetoedByUser || isHost}
          className={`w-full py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
            isVetoedByUser
              ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 cursor-default'
              : isHost
              ? 'bg-zinc-800/50 text-zinc-500 border border-zinc-700 cursor-not-allowed'
              : 'bg-neon-magenta/20 text-neon-magenta border-2 border-neon-magenta hover:bg-neon-magenta/30 hover:shadow-[0_0_20px_rgba(255,0,255,0.3)] active:scale-95'
          }`}
        >
          {isVetoedByUser ? '✓ Veto Cast' : isHost ? 'Host Cannot Vote' : 'Cast Veto'}
        </button>
      </div>
    </div>
  )
}
