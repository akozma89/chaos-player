'use client'

import React from 'react'

interface ChaosSyncOverlayProps {
  isVisible: boolean
}

export function ChaosSyncOverlay({ isVisible }: ChaosSyncOverlayProps) {
  if (!isVisible) return null

  return (
    <div 
      data-testid="chaos-sync-overlay"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-500"
    >
      <div className="relative">
        {/* Animated neon ring */}
        <div className="w-20 h-20 rounded-full border-2 border-neon-blue/20 animate-ping absolute inset-0" />
        <div className="w-20 h-20 rounded-full border-2 border-t-neon-blue border-r-neon-pink/50 border-b-neon-purple/30 border-l-transparent animate-spin" />
        
        {/* Central icon/text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl animate-pulse">⚡</span>
        </div>
      </div>
      
      <div className="mt-6 text-center space-y-1">
        <h3 className="text-neon-blue font-black tracking-widest text-sm uppercase animate-pulse">
          Chaos Syncing
        </h3>
        <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-tighter">
          Calibrating democratic frequencies...
        </p>
      </div>
      
      {/* Glitch bar at bottom */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue via-neon-pink to-neon-purple opacity-50 animate-pulse" />
    </div>
  )
}
