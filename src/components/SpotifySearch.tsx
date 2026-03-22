'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { searchSpotify } from '../lib/spotify'
import type { SourceSearchResult } from '../lib/spotify'
import { addToQueue } from '../lib/queue'
import { useDebounce } from '../hooks/useDebounce'
import ConnectSpotify from './ConnectSpotify'

interface SpotifySearchProps {
  roomId: string
  userId: string
  clientId: string
  accessToken?: string
  username?: string
}

export default function SpotifySearch({ roomId, userId, clientId, accessToken: initialToken, username }: SpotifySearchProps) {
  const [token, setToken] = useState<string | null>(initialToken ?? null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SourceSearchResult[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [addedId, setAddedId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debouncedQuery = useDebounce(query, 500)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    async function search() {
      if (!debouncedQuery || !token) {
        setResults([])
        setError(null)
        setIsSearching(false)
        setSelectedIndex(-1)
        return
      }

      setIsSearching(true)
      const { items, error: searchError } = await searchSpotify({ query: debouncedQuery, accessToken: token })
      setResults(items)
      setError(searchError ?? null)
      setIsSearching(false)
      setSelectedIndex(-1)
    }
    search()
  }, [debouncedQuery, token])

  // Escape key dismisses results
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setResults([])
        setError(null)
        setSelectedIndex(-1)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Outside-click dismisses results
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([])
        setError(null)
        setSelectedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
    setSelectedIndex(-1)
  }, [])

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setResults([])
      setError(null)
      setSelectedIndex(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => {
        const next = prev < results.length - 1 ? prev + 1 : prev
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : prev
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault()
        handleAdd(results[selectedIndex])
      }
    }
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!token) {
    return (
      <ConnectSpotify
        clientId={clientId}
        onConnected={(newToken) => setToken(newToken)}
        onDisconnected={() => setToken(null)}
      />
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search Spotify..."
          className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20 transition pr-16"
        />
        {isSearching && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-neon-green/30 border-t-neon-green rounded-full animate-spin" />
          </div>
        )}
        {query && (
          <button
            aria-label="Clear search"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error.message}
        </div>
      )}

      {debouncedQuery && !isSearching && results.length === 0 && !error && (
        <div className="mt-2 px-3 py-2 text-zinc-500 text-sm text-center">
          No results for &ldquo;{debouncedQuery}&rdquo;
        </div>
      )}

      {results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((result, index) => {
            const isAdded = addedId === result.sourceId
            const isAdding = addingId === result.sourceId
            const isSelected = selectedIndex === index

            return (
              <li key={result.sourceId}>
                <button
                  ref={(el) => { itemRefs.current[index] = el }}
                  onClick={() => handleAdd(result)}
                  disabled={isAdding || isAdded || addingId !== null}
                  className={`w-full flex items-center gap-3 p-2 border-b border-white/5 last:border-b-0 transition text-left ${
                    isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  {result.thumbnailUrl ? (
                    <Image
                      src={result.thumbnailUrl}
                      alt={result.title}
                      width={48}
                      height={48}
                      className="object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-zinc-800 rounded flex-shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-neon-green/40" aria-hidden="true">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <p className="font-medium text-sm text-white truncate">{result.title}</p>
                    <p className="text-xs text-zinc-400 truncate">{result.artist}</p>
                    <p className="text-xs text-zinc-500">{formatDuration(result.duration)}</p>
                  </div>
                  <div
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      isAdded
                        ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 cursor-default'
                        : isAdding
                          ? 'bg-neon-green/10 text-neon-green border border-neon-green/20 cursor-wait'
                          : 'bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20'
                    }`}
                  >
                    {isAdded ? '✓ Added' : isAdding ? '...' : '+ Add'}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
