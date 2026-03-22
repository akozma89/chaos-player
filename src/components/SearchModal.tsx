'use client'

import React, { useState, useEffect } from 'react'
import YouTubeSearchModal from './YouTubeSearchModal'
import SpotifySearchModal from './SpotifySearchModal'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  userId: string
  username?: string
  clientId: string
  allowedResources: 'youtube' | 'spotify' | 'both'
}

export function SearchModal({
  isOpen,
  onClose,
  roomId,
  userId,
  username,
  clientId,
  allowedResources,
}: SearchModalProps) {
  const [activeSource, setActiveSource] = useState<'youtube' | 'spotify'>(
    allowedResources === 'spotify' ? 'spotify' : 'youtube'
  )

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm lg:bg-black/60">
      {/* Modal Container */}
      <div className="w-full h-screen lg:h-[90vh] lg:max-w-4xl lg:rounded-2xl bg-black border-0 lg:border lg:border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-4 border-b border-white/10 bg-black/95 backdrop-blur-sm z-10">
          <h1 className="text-xl font-bold text-white">Add Tracks</h1>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors border border-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Source Toggle */}
        {allowedResources === 'both' && (
          <div className="flex gap-1 p-4 bg-black/50 border-b border-white/5">
            <button
              onClick={() => setActiveSource('youtube')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                activeSource === 'youtube'
                  ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              YouTube
            </button>
            <button
              onClick={() => setActiveSource('spotify')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                activeSource === 'spotify'
                  ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Spotify
            </button>
          </div>
        )}

        {/* Search Content */}
        <div className="flex-1 overflow-hidden">
          {allowedResources !== 'spotify' && activeSource === 'youtube' && (
            <YouTubeSearchModal roomId={roomId} userId={userId} username={username} />
          )}
          {allowedResources !== 'youtube' && activeSource === 'spotify' && (
            <SpotifySearchModal roomId={roomId} userId={userId} clientId={clientId} username={username} />
          )}
        </div>
      </div>
    </div>
  )
}
