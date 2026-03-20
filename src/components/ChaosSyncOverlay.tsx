'use client'

import React from 'react'

interface ChaosSyncOverlayProps {
  isSyncing: boolean
}

export default function ChaosSyncOverlay({ isSyncing }: ChaosSyncOverlayProps) {
  if (!isSyncing) return null

  return (
    <div 
      data-testid="chaos-sync-overlay"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-500"
    >
      <div className="relative">
        {/* Animated neon ring */}
        <div className="w-24 h-24 rounded-full border-2 border-neon-cyan/20 animate-ping absolute inset-0" />
        <div className="w-24 h-24 rounded-full border-4 border-t-neon-cyan border-r-neon-cyan/50 border-b-neon-cyan/20 border-l-transparent animate-spin shadow-[0_0_15px_rgba(0,255,255,0.5)]" />
        
        {/* Central icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl text-neon-cyan animate-pulse drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]">⚡</span>
        </div>
      </div>
      
      <div className="mt-8 text-center space-y-2">
        <h3 className="text-neon-cyan font-black tracking-widest text-lg uppercase animate-pulse drop-shadow-[0_0_10px_rgba(0,255,255,0.6)]">
          Chaos Sync in progress
        </h3>
        <p className="text-sm text-zinc-400 font-mono uppercase tracking-widest">
          Democracy is choosing the next track
        </p>
      </div>
      
      {/* Glitch bar at bottom */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-neon-cyan shadow-[0_-2px_10px_rgba(0,255,255,0.5)] animate-pulse" />
    </div>
  )
}
