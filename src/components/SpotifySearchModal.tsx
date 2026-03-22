'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { searchSpotify } from '../lib/spotify'
import type { SourceSearchResult } from '../lib/spotify'
import { addToQueue } from '../lib/queue'
import { useDebounce } from '../hooks/useDebounce'
import ConnectSpotify from './ConnectSpotify'

interface SpotifySearchModalProps {
  roomId: string
  userId: string
  clientId: string
  accessToken?: string
  username?: string
}

export default function SpotifySearchModal({
  roomId,
  userId,
  clientId,
  accessToken: initialToken,
  username,
}: SpotifySearchModalProps) {
  const [token, setToken] = useState<string | null>(initialToken ?? null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SourceSearchResult[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [addedId, setAddedId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 500)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function search() {
      if (!debouncedQuery || !token) {
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      const { items, error: searchError } = await searchSpotify({ query: debouncedQuery, accessToken: token, limit: 12 })
      setResults(items)
      setError(searchError ?? null)
      setIsSearching(false)
    }
    search()
  }, [debouncedQuery, token])

  useEffect(() => {
    inputRef.current?.focus()
  }, [token])

  const handleAdd = useCallback(
    async (result: SourceSearchResult) => {
      if (addingId || addedId === result.sourceId) return
      setAddingId(result.sourceId)
      await addToQueue({
        roomId,
        addedBy: userId,
        addedByName: username,
        source: 'spotify',
        sourceId: result.sourceId,
        title: result.title,
        artist: result.artist,
        duration: result.duration,
        thumbnailUrl: result.thumbnailUrl,
      })
      setAddedId(result.sourceId)
      setAddingId(null)
      setTimeout(() => {
        setAddedId(null)
      }, 2000)
    },
    [roomId, userId, username, addingId, addedId]
  )

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center h-full">
        <ConnectSpotify
          clientId={clientId}
          onConnected={(newToken) => setToken(newToken)}
          onDisconnected={() => setToken(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="sticky top-0 p-4 bg-black/50 border-b border-white/10 z-10">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Spotify..."
            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20 transition"
          />
          {isSearching ? (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-white" style={{ animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : query && (
            <button
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition"
            >
              ✕
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error.message}
          </div>
        )}
      </div>

      {/* Results Grid */}
      <div className="flex-1 overflow-y-auto">
        {debouncedQuery && !isSearching && results.length === 0 && !error && (
          <div className="flex items-center justify-center h-40 text-zinc-500">
            No results for &ldquo;{debouncedQuery}&rdquo;
          </div>
        )}

        {results.length > 0 && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result) => {
              const isAdded = addedId === result.sourceId
              const isAdding = addingId === result.sourceId

              return (
                <div
                  key={result.sourceId}
                  className="bg-zinc-900/50 rounded-xl border border-white/5 overflow-hidden hover:border-neon-green/30 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-square bg-zinc-800 overflow-hidden">
                    {result.thumbnailUrl ? (
                      <img
                        src={result.thumbnailUrl}
                        alt={result.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl bg-zinc-900">🎧</div>
                    )}

                    {/* Source Badge - Top Left */}
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-neon-green flex items-center gap-1">
                      <span className="text-xs font-bold text-black">Spotify</span>
                    </div>

                    {/* Duration - Bottom Right */}
                    {result.duration > 0 && (
                      <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-semibold text-white">
                        {formatDuration(result.duration)}
                      </span>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition" />
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate" title={result.title}>
                        {result.title}
                      </h3>
                      <p className="text-xs text-zinc-400 truncate" title={result.artist}>
                        {result.artist}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAdd(result)}
                      disabled={isAdding || isAdded}
                      className={`w-full py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                        isAdded
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 cursor-default'
                          : isAdding
                            ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 cursor-not-allowed'
                            : 'bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20'
                      }`}
                    >
                      {isAdded ? '✓ Added' : isAdding ? 'Adding...' : '+ Add to Queue'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
