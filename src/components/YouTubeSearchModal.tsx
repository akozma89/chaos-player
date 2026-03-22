'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { searchYouTubeWithErrors, YouTubeSearchResult, YouTubeError } from '../lib/youtube'
import { addToQueue } from '../lib/queue'
import { useDebounce } from '../hooks/useDebounce'

interface YouTubeSearchModalProps {
  roomId: string
  userId: string
  username?: string
}

export default function YouTubeSearchModal({ roomId, userId, username }: YouTubeSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [error, setError] = useState<YouTubeError | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const debouncedQuery = useDebounce(query, 500)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function search() {
      if (!debouncedQuery) {
        setResults([])
        setError(null)
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      const { results: searchResults, error: searchError } = await searchYouTubeWithErrors(debouncedQuery)
      setResults(searchResults)
      setError(searchError)
      setIsSearching(false)
    }
    search()
  }, [debouncedQuery])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleAdd = useCallback(
    async (result: YouTubeSearchResult) => {
      if (addingIds.has(result.sourceId)) return

      setAddingIds((prev) => new Set(prev).add(result.sourceId))

      await addToQueue({
        roomId,
        sourceId: result.sourceId,
        source: 'youtube',
        title: result.title,
        artist: result.channelTitle,
        duration: result.duration,
        addedBy: userId,
        addedByName: username,
        thumbnailUrl: result.thumbnail,
      })

      const next = new Set(addingIds)
      next.delete(result.sourceId)
      setAddingIds(next)

      setAddedIds((prev) => new Set(prev).add(result.sourceId))

      setTimeout(() => {
        setAddedIds((prev) => {
          const next = new Set(prev)
          next.delete(result.sourceId)
          return next
        })
      }, 2000)
    },
    [roomId, userId, username, addingIds]
  )

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
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
            placeholder="Search YouTube..."
            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
            </div>
          )}
          {query && (
            <button
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                setResults([])
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
            {error.type === 'quota_exceeded' ? 'YouTube quota exceeded — try again later.' : error.message}
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
              const isAdded = addedIds.has(result.sourceId)
              const isAdding = addingIds.has(result.sourceId)

              return (
                <div
                  key={result.sourceId}
                  className="bg-zinc-900/50 rounded-xl border border-white/5 overflow-hidden hover:border-neon-blue/30 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-video bg-zinc-800 overflow-hidden">
                    {result.thumbnailUrl ? (
                      <img
                        src={result.thumbnailUrl}
                        alt={result.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl bg-zinc-900">🔴</div>
                    )}

                    {/* Source Badge - Top Left */}
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-red-600 flex items-center gap-1">
                      <span className="text-xs font-bold text-white">YouTube</span>
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
                      <p className="text-xs text-zinc-400 truncate" title={result.channelTitle}>
                        {result.channelTitle}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAdd(result)}
                      disabled={isAdding || isAdded}
                      className={`w-full py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                        isAdded
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 cursor-default'
                          : isAdding
                            ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30 cursor-not-allowed'
                            : 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20'
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
