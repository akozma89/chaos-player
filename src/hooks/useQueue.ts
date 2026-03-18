'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getQueueItems, castVote, computeQueueOrder } from '../lib/queue'
import { advanceQueue as libAdvanceQueue } from '../lib/autoAdvance'
import type { QueueItem } from '../types'

export function useQueue(roomId: string, userId: string) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    if (!roomId) return
    const { data, error: fetchError } = await getQueueItems(roomId)
    if (fetchError) {
      setError(fetchError.message)
    } else {
      // items will contain playing and pending items
      setItems(data)
    }
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      return
    }

    loadQueue()

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`queue:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_items', filter: `room_id=eq.${roomId}` },
        () => loadQueue()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        () => loadQueue()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, loadQueue])

  const vote = useCallback(
    async (queueItemId: string, type: 'upvote' | 'downvote') => {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== queueItemId) return item
          return {
            ...item,
            upvotes: type === 'upvote' ? item.upvotes + 1 : item.upvotes,
            downvotes: type === 'downvote' ? item.downvotes + 1 : item.downvotes,
          }
        })
      )

      const { error: voteError } = await castVote({ queueItemId, userId, type })
      if (voteError) {
        // Revert on error
        await loadQueue()
      }
    },
    [userId, loadQueue]
  )

  const advanceQueue = useCallback(async () => {
    const currentPlaying = items.find(i => i.status === 'playing')
    if (!currentPlaying) return

    const { error: advanceError } = await libAdvanceQueue({
      currentItemId: currentPlaying.id,
      queue: items,
      roomId
    })

    if (advanceError) {
      setError(advanceError.message)
    } else {
      await loadQueue()
    }
  }, [roomId, items, loadQueue])

  // Split items for UI
  const playing = items.find(i => i.status === 'playing') || null
  const pending = computeQueueOrder(items.filter(i => i.status === 'pending'))

  return { 
    items, 
    playing, 
    pending, 
    loading, 
    error, 
    vote, 
    advanceQueue,
    refresh: loadQueue 
  }
}
