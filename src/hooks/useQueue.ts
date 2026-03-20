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
  const bootstrapRetryCount = useRef(0)
  const bootstrapTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
      bootstrapRetryCount.current = 0
      if (bootstrapTimeoutRef.current) clearTimeout(bootstrapTimeoutRef.current)
      return
    }

    if (isPlaying || !topPending) {
      setSyncing(false)
      return
    }

    // If we already successfully bootstrapped this track or exhausted retries for it, skip
    if (lastBootstrappedId.current === topPending.id && bootstrapRetryCount.current >= 3) {
      return
    }

    // If we are already bootstrapping this track, don't start another one
    if (lastBootstrappedId.current === topPending.id && isSyncingRef.current) {
        return
    }

    // New track or retry
    lastBootstrappedId.current = topPending.id
    setSyncing(true)

    const performBootstrap = async () => {
      try {
        const { error: bootstrapError } = await bootstrapQueue({ queue: data, roomId })

        if (bootstrapError) {
          console.error('Bootstrap failed:', bootstrapError)

          if (bootstrapRetryCount.current < 3) {
            bootstrapRetryCount.current += 1
            console.log(`Retrying bootstrap (${bootstrapRetryCount.current}/3) in 2s...`)

            // Reset sync state so the retry is not blocked by the guard
            setSyncing(false)

            bootstrapTimeoutRef.current = setTimeout(() => {
              loadQueueWithBootstrap()
            }, 2000)
          } else {
            setSyncing(false)
          }
        } else {
          bootstrapRetryCount.current = 0
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
      if (bootstrapTimeoutRef.current) clearTimeout(bootstrapTimeoutRef.current)
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
