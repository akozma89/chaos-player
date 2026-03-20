'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getQueueItems, castVote, computeQueueOrder, computeVoteDelta, getUserVotes } from '../lib/queue'
import { advanceQueue as libAdvanceQueue, bootstrapQueue } from '../lib/autoAdvance'
import { checkAndAwardCrowdPleaser } from '../lib/tokenEarn'
import type { QueueItem } from '../types'

export function useQueue(roomId: string, userId: string) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [userVotes, setUserVotes] = useState<Record<string, 'upvote' | 'downvote'>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentReward, setRecentReward] = useState<{ amount: number; userId: string; queueItemId: string } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const isSyncingRef = useRef(false)

  const setSyncing = useCallback((val: boolean) => {
    isSyncingRef.current = val
    setIsSyncing(val)
  }, [])

  // Resilient Bootstrap v2: track-specific guards
  const lastBootstrappedId = useRef<string | null>(null)

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

  const loadUserVotes = useCallback(async () => {
    if (!roomId || !userId) return
    const { data, error: fetchError } = await getUserVotes(roomId, userId)
    if (fetchError) {
      console.error('Failed to load user votes:', fetchError)
    } else {
      setUserVotes(data)
    }
  }, [roomId, userId])

  const loadQueueWithBootstrap = useCallback(async () => {
    if (!roomId) return
    const { data, error: fetchError } = await getQueueItems(roomId)
    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setItems(data)
    setLoading(false)

    // Bootstrap check: if no track is playing, promote the top pending item
    const isPlaying = data.some(i => i.status === 'playing')
    const pendingItems = computeQueueOrder(data.filter(i => i.status === 'pending'))
    const topPending = pendingItems[0]

    // If nothing is playing and nothing is pending, the queue is empty.
    if (!isPlaying && !topPending) {
      lastBootstrappedId.current = null
      return
    }

    if (isPlaying || !topPending) {
      setSyncing(false)
      return
    }

    // If we already tried to bootstrap this track (successfully or failed after retries), 
    // we don't try again unless it's a DIFFERENT track.
    if (lastBootstrappedId.current === topPending.id) {
      return
    }

    // New track to bootstrap
    lastBootstrappedId.current = topPending.id
    setSyncing(true)

    const performBootstrap = async () => {
      try {
        const { error: bootstrapError } = await bootstrapQueue({ queue: data, roomId })

        if (bootstrapError) {
          console.error('Bootstrap failed after retries:', bootstrapError)
          // On total failure, we reset sync state AND lastBootstrappedId
          // so it can retry if a NEW update comes in later.
          setSyncing(false)
          lastBootstrappedId.current = null
        } else {
          // SUCCESS: DON'T setSyncing(false) here. 
          // Wait for the real-time update where isPlaying will be true, 
          // which will trigger setSyncing(false) at the top of loadQueueWithBootstrap.
        }
      } catch (err) {
        console.error('Bootstrap exception:', err)
        setSyncing(false)
      }
    }
    performBootstrap()
  }, [roomId, setSyncing])
  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      return
    }

    // Initial load with bootstrap check
    loadQueueWithBootstrap()
    loadUserVotes()

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
  }, [roomId, loadQueueWithBootstrap, loadUserVotes])

  const vote = useCallback(
    async (queueItemId: string, type: 'upvote' | 'downvote') => {
      const prevVote = userVotes[queueItemId]
      const finalType = prevVote === type ? null : type
      const { upvoteDelta, downvoteDelta } = computeVoteDelta(finalType, prevVote)

      // Optimistic update using delta (handles vote flips and toggles correctly)
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

      // Record the new vote direction (or removal) immediately in state
      setUserVotes((prev) => {
        const next = { ...prev }
        if (finalType === null) {
          delete next[queueItemId]
        } else {
          next[queueItemId] = finalType
        }
        return next
      })

      const { error: voteError } = await castVote({ queueItemId, userId, roomId, type: finalType })
      if (voteError) {
        // Revert on error
        setUserVotes((prev) => {
          const next = { ...prev }
          if (prevVote) next[queueItemId] = prevVote
          else delete next[queueItemId]
          return next
        })
        await loadQueue()
      } else {
        // Successful vote (only check for reward if not a removal)
        if (finalType !== null) {
          const rewardResult = await checkAndAwardCrowdPleaser({ queueItemId, roomId })
          if (rewardResult.awarded) {
            setRecentReward({
              amount: rewardResult.tokensAwarded,
              userId: rewardResult.userId!,
              queueItemId: queueItemId
            })
            // Auto-clear reward notification after 5s
            setTimeout(() => setRecentReward(null), 5000)
          }
        }
      }
    },
    [userId, roomId, loadQueue, userVotes]
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
    userVotes,
    recentReward,
    advanceQueue,
    isSyncing,
    refresh: loadQueueWithBootstrap 
  }
}
