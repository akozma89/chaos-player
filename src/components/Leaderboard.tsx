'use client'

import { useEffect, useState, useCallback } from 'react'
import { getLeaderboard, subscribeToLeaderboard } from '../lib/leaderboard'
import type { LeaderboardEntry } from '../lib/leaderboard'

interface LeaderboardProps {
  roomId: string
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Leaderboard({ roomId }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const totalPages = Math.max(1, Math.ceil(entries.length / ITEMS_PER_PAGE))
  const paginatedEntries = entries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const refresh = useCallback(async () => {
    const { data } = await getLeaderboard(roomId)
    if (data) setEntries(data)
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeToLeaderboard(roomId, () => refresh())
    return unsubscribe
  }, [roomId, refresh])

  return (
    <div
      className="rounded-xl border border-purple-500/30 bg-gray-900 p-4 shadow-lg shadow-purple-900/20"
      data-testid="leaderboard"
    >
      {/* Header */}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-purple-400">
        Leaderboard
      </h2>

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-500">No players yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {paginatedEntries.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center gap-3 rounded-lg bg-gray-800/60 px-3 py-2"
              data-testid={`leaderboard-entry-${entry.userId}`}
            >
              {/* Rank badge */}
              <span className="w-6 text-center text-base leading-none">
                {MEDAL[entry.rank] ?? (
                  <span className="text-xs font-semibold text-gray-400">{entry.rank}</span>
                )}
              </span>

              {/* Username */}
              <span className="flex-1 truncate text-sm font-semibold text-white">
                {entry.username}
                {entry.isHost && (
                  <span className="ml-2 text-xs font-normal text-neon-pink/80">
                    (owner)
                  </span>
                )}
              </span>

              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span title="Tokens spent" className="flex items-center gap-1">
                  <span className="text-yellow-400">⚡</span>
                  {entry.tokensSpent}
                </span>
                <span title="Tokens earned" className="flex items-center gap-1">
                  <span className="text-neon-blue">💎</span>
                  {entry.tokensEarned}
                </span>
                <span title="Votes cast" className="flex items-center gap-1">
                  <span className="text-green-400">↑</span>
                  {entry.voteCount}
                </span>
                <span
                  title="Engagement score"
                  className="rounded-full bg-purple-600/40 px-2 py-0.5 font-bold text-purple-300"
                >
                  {entry.engagementScore}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Pagination Controls */}
      {entries.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ← Prev
          </button>
          <span className="text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
