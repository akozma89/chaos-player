'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getQueueItems, castVote, computeQueueOrder, computeVoteDelta } from '../lib/queue'
import { advanceQueue as libAdvanceQueue, promoteToPlaying } from '../lib/autoAdvance'
import type { QueueItem } from '../types'

export function useQueue(roomId: string, userId: string) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track user's current vote per queue item for optimistic delta computation
  const userVotes = useRef<Map<string, 'upvote' | 'downvote'>>(new Map())
  // Guard to ensure we only ever trigger bootstrap once per session
  const hasBootstrapped = useRef(false)

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

  // Bootstrap: if no track is playing, promote the top pending item
  const bootstrapQueueStartup = useCallback(async (loadedItems: QueueItem[]) => {
    if (hasBootstrapped.current) return

    const isPlaying = loadedItems.some(i => i.status === 'playing')
    const hasPending = loadedItems.some(i => i.status === 'pending')

    if (isPlaying || !hasPending) return

    // Mark as bootstrapped BEFORE call to prevent concurrent attempts during async call
    hasBootstrapped.current = true

    const { error: bootstrapError } = await promoteToPlaying({ queue: loadedItems, roomId })
    if (bootstrapError) {
      // If it failed, we might want to allow another attempt later,
      // but to prevent spamming, we keep it as true for now.
      console.error('Bootstrap failed:', bootstrapError)
    }
  }, [roomId])

  const loadQueueWithBootstrap = useCallback(async () => {
    if (!roomId) return
    const { data, error: fetchError } = await getQueueItems(roomId)
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setItems(data)
      await bootstrapQueueStartup(data)
    }
    setLoading(false)
  }, [roomId, bootstrapQueueStartup])

  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      return
    }

    // Initial load with bootstrap check
    loadQueueWithBootstrap()

    // Subscribe to realtime changes — also runs bootstrap so newly added tracks auto-start
    // Note: only subscribe to queue_items — votes are reflected via castVote RPC, no separate votes subscription needed.
    const channel = supabase
      .channel(`queue:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_items', filter: `room_id=eq.${roomId}` },
        () => loadQueueWithBootstrap()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, loadQueueWithBootstrap])

  const vote = useCallback(
    async (queueItemId: string, type: 'upvote' | 'downvote') => {
      const prevVote = userVotes.current.get(queueItemId)
      const { upvoteDelta, downvoteDelta } = computeVoteDelta(type, prevVote)

      // Optimistic update using delta (handles vote flips correctly)
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== queueItemId) return item
          return {
            ...item,
            upvotes: item.upvotes + upvoteDelta,
            downvotes: item.downvotes + downvoteDelta,
          }
        })
      )

      // Record the new vote direction immediately
      userVotes.current.set(queueItemId, type)

      const { error: voteError } = await castVote({ queueItemId, userId, type })
      if (voteError) {
        // Revert on error
        userVotes.current.set(queueItemId, prevVote as 'upvote' | 'downvote')
        if (!prevVote) userVotes.current.delete(queueItemId)
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
