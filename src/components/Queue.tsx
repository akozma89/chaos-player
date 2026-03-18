'use client'

import { useQueue } from '../hooks/useQueue'
import { VoteButton } from './VoteButton'
import type { QueueItem } from '../types'

interface Props {
  roomId: string
  userId: string
  onSkip?: (item: QueueItem) => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Queue({ roomId, userId }: Props) {
  const { items, loading, error, vote } = useQueue(roomId, userId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Loading queue...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-4 text-red-400 text-sm">
        Failed to load queue: {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <p className="text-lg">Queue is empty</p>
        <p className="text-sm mt-1">Add a YouTube track to get started</p>
      </div>
    )
  }

  return (
    <ol className="flex flex-col gap-2" aria-label="Music queue">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
            item.status === 'playing'
              ? 'border-neon-pink bg-gray-800/80'
              : 'border-gray-700 bg-gray-800/40 hover:bg-gray-800/60'
          }`}
        >
          {/* Position */}
          <span className="text-gray-600 font-mono text-sm w-5 text-center shrink-0">
            {item.status === 'playing' ? '▶' : index + 1}
          </span>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate text-sm">{item.title}</p>
            <p className="text-gray-400 text-xs truncate">{item.artist}</p>
          </div>

          {/* Duration */}
          <span className="text-gray-500 font-mono text-xs shrink-0">
            {formatDuration(item.duration)}
          </span>

          {/* Voting */}
          <div className="flex items-center gap-1 shrink-0">
            <VoteButton
              type="upvote"
              count={item.upvotes}
              onClick={() => vote(item.id, 'upvote')}
              disabled={item.status !== 'pending'}
            />
            <VoteButton
              type="downvote"
              count={item.downvotes}
              onClick={() => vote(item.id, 'downvote')}
              disabled={item.status !== 'pending'}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
