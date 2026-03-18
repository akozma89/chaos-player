'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { searchYouTubeWithErrors, YouTubeSearchResult, YouTubeError } from '../lib/youtube'
import { addToQueue } from '../lib/queue'
import { useDebounce } from '../hooks/useDebounce'

interface YouTubeSearchProps {
  roomId: string
  userId: string
}

export default function YouTubeSearch({ roomId, userId }: YouTubeSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [error, setError] = useState<YouTubeError | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [addedId, setAddedId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 500)

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

  const handleAdd = useCallback(
    async (result: YouTubeSearchResult) => {
      setAddingId(result.sourceId)
      await addToQueue({
        roomId,
        addedBy: userId,
        source: 'youtube',
        sourceId: result.sourceId,
        title: result.title,
        artist: result.channelTitle,
        duration: result.duration,
      })
      setAddedId(result.sourceId)
      setAddingId(null)
      // Clear feedback after 2s then collapse results
      setTimeout(() => {
        setAddedId(null)
        setQuery('')
        setResults([])
      }, 2000)
    },
    [roomId, userId]
  )

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search YouTube..."
          className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error.type === 'quota_exceeded' ? 'YouTube quota exceeded — try again later.' : error.message}
        </div>
      )}

      {results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {results.map((result) => {
            const isAdded = addedId === result.sourceId
            const isAdding = addingId === result.sourceId

            return (
              <li
                key={result.sourceId}
                className="flex items-center gap-3 p-2 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition"
              >
                <Image
                  src={result.thumbnailUrl}
                  alt={result.title}
                  width={64}
                  height={48}
                  className="object-cover rounded flex-shrink-0"
                />
                <div className="flex-grow min-w-0">
                  <p className="font-medium text-sm text-white truncate">{result.title}</p>
                  <p className="text-xs text-zinc-400 truncate">{result.channelTitle}</p>
                  <p className="text-xs text-zinc-500">{formatDuration(result.duration)}</p>
                </div>
                <button
                  onClick={() => handleAdd(result)}
                  disabled={isAdding || isAdded || addingId !== null}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    isAdded
                      ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 cursor-default'
                      : isAdding
                        ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20 cursor-wait'
                        : 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20'
                  }`}
                >
                  {isAdded ? '✓ Added' : isAdding ? '...' : '+ Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
