'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debouncedQuery = useDebounce(query, 500)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    async function search() {
      if (!debouncedQuery) {
        setResults([])
        setError(null)
        setIsSearching(false)
        setSelectedIndex(-1)
        return
      }

      setIsSearching(true)
      const { results: searchResults, error: searchError } = await searchYouTubeWithErrors(debouncedQuery)
      setResults(searchResults)
      setError(searchError)
      setIsSearching(false)
      setSelectedIndex(-1)
    }
    search()
  }, [debouncedQuery])

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
    async (result: YouTubeSearchResult) => {
      const id = result.sourceId
      if (addingIds.has(id) || addedIds.has(id)) return

      setAddingIds((prev) => new Set(prev).add(id))

      await addToQueue({
        roomId,
        addedBy: userId,
        source: 'youtube',
        sourceId: result.sourceId,
        title: result.title,
        artist: result.channelTitle,
        duration: result.duration,
      })

      setAddingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      
      // Task 2: Close results and clear query immediately on selection
      setResults([])
      setQuery('')
      setSelectedIndex(-1)

      setAddedIds((prev) => new Set(prev).add(id))

      setTimeout(() => {
        setAddedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 2000)
    },
    [roomId, userId, addingIds, addedIds]
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

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search YouTube..."
          className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition pr-16"
        />
        {isSearching && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
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
          {error.type === 'quota_exceeded' ? 'YouTube quota exceeded — try again later.' : error.message}
        </div>
      )}

      {debouncedQuery && !isSearching && results.length === 0 && !error && (
        <div className="mt-2 px-3 py-2 text-zinc-500 text-sm text-center">
          No results for &ldquo;{debouncedQuery}&rdquo;
        </div>
      )}

      {results.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto ring-1 ring-black/50">
          {results.map((result, index) => {
            const isAdded = addedIds.has(result.sourceId)
            const isAdding = addingIds.has(result.sourceId)
            const isSelected = selectedIndex === index

            return (
              <li key={result.sourceId}>
                <button
                  ref={(el) => { itemRefs.current[index] = el }}
                  onClick={() => handleAdd(result)}
                  disabled={isAdding || isAdded}
                  className={`w-full flex items-center gap-3 p-2.5 border-b border-white/5 last:border-b-0 transition text-left group ${
                    isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative w-16 h-12 flex-shrink-0">
                    <Image
                      src={result.thumbnailUrl}
                      alt={result.title}
                      fill
                      className="object-cover rounded"
                    />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-semibold text-sm text-white truncate group-hover:text-neon-blue transition-colors">{result.title}</p>
                    <p className="text-xs text-zinc-400 truncate">{result.channelTitle}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">{formatDuration(result.duration)}</p>
                  </div>
                  <span
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      isAdded
                        ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 cursor-default'
                        : isAdding
                          ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20 cursor-wait'
                          : 'bg-white/5 text-zinc-400 border border-white/10 group-hover:bg-neon-blue/20 group-hover:text-neon-blue group-hover:border-neon-blue/30'
                    }`}
                  >
                    {isAdded ? '✓' : isAdding ? '...' : '+'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
