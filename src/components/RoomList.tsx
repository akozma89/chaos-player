'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Room } from '../types'
import { getPublicRooms, getJoinedRooms, getOwnedRooms } from '../lib/rooms'
import { useDebounce } from '../hooks/useDebounce'

interface RoomListProps {
  type: 'public' | 'joined' | 'owned'
  userId?: string
  search: string
  onRoomClick?: (code: string) => void
}

export function RoomList({ type, userId, search, onRoomClick }: RoomListProps) {
  const [rooms, setRooms] = useState<(Room & { code: string })[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const limit = 10

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    async function fetchRooms() {
      setLoading(true)
      try {
        let result
        if (type === 'public') {
          result = await getPublicRooms({ search: debouncedSearch, page, limit })
        } else if (type === 'joined' && userId) {
          result = await getJoinedRooms({ userId, search: debouncedSearch, page, limit })
        } else if (type === 'owned' && userId) {
          result = await getOwnedRooms({ userId, search: debouncedSearch, page, limit })
        }

        if (result && !result.error) {
          setRooms(result.rooms)
          setTotalCount(result.totalCount)
        }
      } finally {
        setLoading(false)
      }
    }

    if (type === 'public' || userId) {
      fetchRooms()
    }
  }, [type, userId, debouncedSearch, page])

  const totalPages = Math.ceil(totalCount / limit)

  if (loading && rooms.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[105px]">
        {rooms.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            {debouncedSearch ? 'No rooms found matching your search.' : 'No rooms found.'}
          </div>
        ) : (
          rooms.map((room) => (
            <Link
              key={room.id}
              href={`/room/${room.code}`}
              className="block p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-neon-cyan transition-colors group"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white group-hover:text-neon-cyan transition-colors">
                    {room.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">CODE: {room.code}</p>
                </div>
                {!room.isPublic && <span title="Private Room">🔒</span>}
              </div>
            </Link>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-800">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
