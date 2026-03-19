'use client'

import { useState } from 'react'

interface AutoplayGuardProps {
  onEnable: () => void
}

export function AutoplayGuard({ onEnable }: AutoplayGuardProps) {
  const [enabled, setEnabled] = useState(false)

  if (enabled) return null

  const handleEnable = () => {
    setEnabled(true)
    onEnable()
  }

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md rounded-2xl border border-neon-blue/20">
      <div className="text-center space-y-6 p-8 max-w-sm">
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-white tracking-tighter italic">
            READY TO <span className="text-neon-blue">CHAOS</span>?
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Browser policies require a click to sync audio with the room.
          </p>
        </div>
        
        <button
          onClick={handleEnable}
          className="w-full py-4 bg-neon-blue text-black font-black rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:shadow-[0_0_30px_rgba(0,243,255,0.6)]"
        >
          JOIN & PLAY 🔊
        </button>
      </div>
    </div>
  )
}
