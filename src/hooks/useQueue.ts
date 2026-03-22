'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getQueueItems, castVote, computeQueueOrder, computeVoteDelta, getUserVotes } from '../lib/queue'
import { advanceQueue as libAdvanceQueue, bootstrapQueue } from '../lib/autoAdvance'
import { checkAndAwardCrowdPleaser } from '../lib/tokenEarn'
import type { QueueItem, Session, Room } from '../types'

export function useQueue(roomId: string, userId: string) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [userVotes, setUserVotes] = useState<Record<string, 'upvote' | 'downvote'>>({})
  const [session, setSession] = useState<Session | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentReward, setRecentReward] = useState<{ amount: number; userId: string; queueItemId: string } | null>(null)
  const [skipVotes, setSkipVotes] = useState<string[]>([])
  const [activeSessionCount, setActiveSessionCount] = useState<number>(1)
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

  const loadSession = useCallback(async () => {
    if (!roomId || !userId) return
    const { data, error: fetchError } = await supabase
      .from('sessions')
      .select()
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single()
    
    if (fetchError) {
      console.error('Failed to load session:', fetchError)
    } else {
      setSession({
        id: data.id,
        roomId: data.room_id,
        userId: data.user_id,
        username: data.username,
        joinedAt: data.joined_at,
        tokens: data.tokens,
        isHost: data.is_host
      })
    }
  }, [roomId, userId])

  const loadRoom = useCallback(async () => {
    if (!roomId) return
    const { data, error: fetchError } = await supabase
      .from('rooms')
      .select()
      .eq('id', roomId)
      .single()
    
    if (fetchError) {
      console.error('Failed to load room:', fetchError)
    } else {
      setRoom({
        id: data.id,
        name: data.name,
        code: data.code,
        hostId: data.host_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        isActive: data.is_active,
        isPublic: data.is_public,
        isPaused: data.is_paused,
        pausedAt: data.paused_at,
        skipVoteCount: data.skip_vote_count,
        allowedResources: data.allowed_resources
      })
    }
  }, [roomId])

  const loadSkipVotes = useCallback(async (playingItemId?: string) => {
    if (!roomId || !playingItemId) {
      setSkipVotes([])
      return
    }
    const { data } = await supabase
      .from('skip_votes')
      .select('user_id')
      .eq('queue_item_id', playingItemId)
    if (data) {
      setSkipVotes(data.map(v => v.user_id))
    }
  }, [roomId])

  const loadSessionCount = useCallback(async () => {
    if (!roomId) return
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
    if (count !== null) {
      setActiveSessionCount(count)
    }
  }, [roomId])

  const loadQueueWithBootstrap = useCallback(async () => {
    if (!roomId) return
    const { data, error: fetchError } = await getQueueItems(roomId)
    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setItems(data)

    // Bootstrap check: if no track is playing, promote the top pending item
    const playingItem = data.find(i => i.status === 'playing')
    const isPlaying = !!playingItem
    const pendingItems = computeQueueOrder(data.filter(i => i.status === 'pending'))
    const topPending = pendingItems[0]

    // If nothing is playing and nothing is pending, the queue is empty.
    if (!isPlaying && !topPending) {
      lastBootstrappedId.current = null
      return
    }

    // Overdue check: track is still marked 'playing' but its duration has elapsed.
    // This happens when the room was empty when the track finished — no client was
    // present to call advanceQueue via the onEnded callback.
    if (playingItem?.playingSince && playingItem.duration > 0) {
      const endTime = new Date(playingItem.playingSince).getTime() + playingItem.duration * 1000
      if (Date.now() > endTime) {
        // Confirm the room isn't paused before advancing (paused rooms have adjusted playingSince)
        const { data: roomRow } = await supabase
          .from('rooms')
          .select('is_paused')
          .eq('id', roomId)
          .single()
        if (!roomRow?.is_paused) {
          await libAdvanceQueue({ currentItemId: playingItem.id, queue: data, roomId })
          return
        }
      }
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
          setSyncing(false)
          lastBootstrappedId.current = null
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

    // Initial load: wait for all essential data
    setLoading(true)
    Promise.all([
      loadQueueWithBootstrap(),
      loadUserVotes(),
      loadSession(),
      loadRoom(),
      loadSessionCount()
    ]).finally(() => {
      setLoading(false)
    })

    // Subscribe to queue_items changes
    const queueChannel = supabase
      .channel(`queue:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_items', filter: `room_id=eq.${roomId}` },
        () => loadQueueWithBootstrap()
      )
      .subscribe()

    // Subscribe to room changes (for pause sync)
    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'is_paused' in payload.new) {
            const data = payload.new as any
            setRoom({
              id: data.id,
              name: data.name,
              code: data.code,
              hostId: data.host_id,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
              isActive: data.is_active,
              isPublic: data.is_public,
              isPaused: data.is_paused,
              pausedAt: data.paused_at,
              skipVoteCount: data.skip_vote_count,
              allowedResources: data.allowed_resources
            })
          } else {
            loadRoom()
          }
        }
      )
      .subscribe()

    const skipVotesChannel = supabase
      .channel(`skip_votes:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'skip_votes', filter: `room_id=eq.${roomId}` },
        () => {
          // Find current playing id. We can't access latest state directly easily in this closure,
          // so we'll rely on the useEffect below to catch changes, but we can also trigger a re-fetch
          // if we had a ref. For simplicity, we trigger loadQueueWithBootstrap which will trigger items change.
          // Wait, just refreshing queue might not fetch skip votes. We'll add a ref for playingId.
        }
      )
      .subscribe()

    const sessionsChannel = supabase
      .channel(`sessions:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `room_id=eq.${roomId}` },
        () => loadSessionCount()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(queueChannel)
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(skipVotesChannel)
      supabase.removeChannel(sessionsChannel)
    }
  }, [roomId, loadQueueWithBootstrap, loadUserVotes, loadSession, loadRoom, loadSessionCount])

  // Split items for UI
  const playing = items.find(i => i.status === 'playing') || null
  const pending = computeQueueOrder(items.filter(i => i.status === 'pending'))

  // Refresh skip votes when playing track changes
  useEffect(() => {
    if (playing?.id) {
      loadSkipVotes(playing.id)
    } else {
      setSkipVotes([])
    }
  }, [playing?.id, loadSkipVotes])

  // Also refresh skip votes on skip_votes table change by using a secondary effect or just 
  // relying on the channel above. Since the channel above doesn't have playing.id, let's fix that.
  useEffect(() => {
    if (!roomId) return
    const skipVotesChannel = supabase
      .channel(`skip_votes_refetch:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'skip_votes', filter: `room_id=eq.${roomId}` },
        () => {
          if (playing?.id) loadSkipVotes(playing.id)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(skipVotesChannel) }
  }, [roomId, playing?.id, loadSkipVotes])

  const vote = useCallback(
    async (queueItemId: string, type: 'upvote' | 'downvote') => {
      const prevVote = userVotes[queueItemId]
      const finalType = prevVote === type ? null : type
      const { upvoteDelta, downvoteDelta } = computeVoteDelta(finalType, prevVote)

      // Optimistic update
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
        if (finalType !== null) {
          const rewardResult = await checkAndAwardCrowdPleaser({ queueItemId, roomId })
          if (rewardResult.awarded) {
            setRecentReward({
              amount: rewardResult.tokensAwarded,
              userId: rewardResult.userId!,
              queueItemId: queueItemId
            })
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

  // Split items for UI already done above but we re-declare it here for the return? 
  // Wait, I moved playing and pending up. Let's just use them.

  return { 
    items, 
    playing, 
    pending, 
    loading, 
    error, 
    vote, 
    userVotes,
    session,
    room,
    recentReward,
    advanceQueue,
    isSyncing,
    skipVotes,
    activeSessionCount,
    refresh: loadQueueWithBootstrap 
  }
}
