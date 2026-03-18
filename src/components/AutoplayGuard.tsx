'use client'

import React, { useState } from 'react'

interface Props {
  onInteract: () => void
}

export function AutoplayGuard({ onInteract }: Props) {
  const [interacted, setInteracted] = useState(false)

  if (interacted) return null

  const handleJoin = () => {
    setInteracted(true)
    onInteract()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-neon-blue/20 p-8 rounded-2xl shadow-2xl text-center space-y-6 max-w-md mx-4 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-neon-blue/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <span className="text-3xl">🔊</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Audio Session Ready</h2>
          <p className="text-gray-400">Tap to join the audio session and start listening with the room.</p>
        </div>
        <button
          onClick={handleJoin}
          className="w-full py-4 px-6 bg-neon-blue text-black font-bold rounded-xl hover:bg-neon-cyan transition-all transform hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(0,183,255,0.3)]"
        >
          Join Session
        </button>
      </div>
    </div>
  )
}
