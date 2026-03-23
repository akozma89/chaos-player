/**
 * Host moderation service - mute/remove users, host skip-override
 * All actions enforce host-only RLS via server-side checks
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyHost(roomId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sessions')
    .select()
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return false
  return (data as Record<string, unknown>).is_host === true
}

// ---------------------------------------------------------------------------
// muteUser
// ---------------------------------------------------------------------------

interface MuteUserParams {
  roomId: string
  targetUserId: string
  hostId: string
}

interface MuteUserResult {
  muted: boolean
  error: Error | null
}

export async function muteUser({ roomId, targetUserId, hostId }: MuteUserParams): Promise<MuteUserResult> {
  const isHost = await verifyHost(roomId, hostId)
  if (!isHost) {
    return { muted: false, error: new Error('Only the host can mute users') }
  }

  // Find target session
  const { data: targetData, error: targetError } = await supabase
    .from('sessions')
    .select()
    .eq('room_id', roomId)
    .eq('user_id', targetUserId)
    .single()

  if (targetError || !targetData) {
    return { muted: false, error: new Error('Target session not found') }
  }

  const { error } = await supabase
    .from('sessions')
    .update({ is_muted: true })
    .eq('id', (targetData as Record<string, unknown>).id)

  if (error) return { muted: false, error: new Error(error.message) }
  return { muted: true, error: null }
}

// ---------------------------------------------------------------------------
// removeUser
// ---------------------------------------------------------------------------

interface RemoveUserParams {
  roomId: string
  targetUserId: string
  hostId: string
}

interface RemoveUserResult {
  removed: boolean
  error: Error | null
}

export async function removeUser({ roomId, targetUserId, hostId }: RemoveUserParams): Promise<RemoveUserResult> {
  if (targetUserId === hostId) {
    return { removed: false, error: new Error('Host cannot remove self') }
  }

  const isHost = await verifyHost(roomId, hostId)
  if (!isHost) {
    return { removed: false, error: new Error('Only the host can remove users') }
  }

  // Find target session
  const { data: targetData, error: targetError } = await supabase
    .from('sessions')
    .select()
    .eq('room_id', roomId)
    .eq('user_id', targetUserId)
    .single()

  if (targetError || !targetData) {
    return { removed: false, error: new Error('Target session not found') }
  }

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', (targetData as Record<string, unknown>).id)

  if (error) return { removed: false, error: new Error(error.message) }
  return { removed: true, error: null }
}

// ---------------------------------------------------------------------------
// hostSkipOverride – skip current track without token cost
// ---------------------------------------------------------------------------

interface HostSkipOverrideParams {
  roomId: string
  queueItemId: string
  hostId: string
}

interface HostSkipOverrideResult {
  tokensSpent: number
  error: Error | null
}

export async function hostSkipOverride({ roomId, queueItemId, hostId }: HostSkipOverrideParams): Promise<HostSkipOverrideResult> {
  const isHost = await verifyHost(roomId, hostId)
  if (!isHost) {
    return { tokensSpent: 0, error: new Error('Only the host can override skip') }
  }

  const { error } = await supabase
    .from('queue_items')
    .update({ status: 'skipped' })
    .eq('id', queueItemId)

  if (error) return { tokensSpent: 0, error: new Error(error.message) }
  return { tokensSpent: 0, error: null }
}

// ---------------------------------------------------------------------------
// isUserMuted – check whether a user is currently muted
// ---------------------------------------------------------------------------

interface IsUserMutedParams {
  roomId: string
  userId: string
}

export async function isUserMuted({ roomId, userId }: IsUserMutedParams): Promise<boolean> {
  const { data, error } = await supabase
    .from('sessions')
    .select()
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return false
  return (data as Record<string, unknown>).is_muted === true
}

// ---------------------------------------------------------------------------
// requestHostSkip – Host initiates a skip that can be vetoed
// ---------------------------------------------------------------------------

interface RequestHostSkipParams {
  roomId: string
  queueItemId: string
  hostId: string
  vetoThreshold?: number
  durationMs?: number
}

interface RequestHostSkipResult {
  requestId: string | null
  error: Error | null
}

export async function requestHostSkip({
  roomId,
  queueItemId,
  hostId,
  vetoThreshold = 50,
  durationMs = 30000, // 30s default
}: RequestHostSkipParams): Promise<RequestHostSkipResult> {
  const isHost = await verifyHost(roomId, hostId)
  if (!isHost) {
    return { requestId: null, error: new Error('Only the host can request a skip') }
  }

  // Delete any non-pending skip requests for this item/host to avoid constraint violations
  await supabase
    .from('skip_requests')
    .delete()
    .eq('queue_item_id', queueItemId)
    .eq('host_id', hostId)
    .neq('status', 'pending')

  const expiresAt = new Date(Date.now() + durationMs).toISOString()

  const { data, error } = await supabase
    .from('skip_requests')
    .insert({
      room_id: roomId,
      queue_item_id: queueItemId,
      host_id: hostId,
      status: 'pending',
      expires_at: expiresAt,
      veto_threshold: vetoThreshold,
    })
    .select()
    .single()

  if (error) return { requestId: null, error: new Error(error.message) }
  return { requestId: (data as Record<string, unknown>).id as string, error: null }
}

// ---------------------------------------------------------------------------
// vetoHostSkip – User votes to veto a host skip request
// ---------------------------------------------------------------------------

interface VetoHostSkipParams {
  requestId: string
  userId: string
}

interface VetoHostSkipResult {
  vetoed: boolean
  error: Error | null
}

export async function vetoHostSkip({
  requestId,
  userId,
}: VetoHostSkipParams): Promise<VetoHostSkipResult> {
  const { data, error } = await supabase.rpc('cast_veto_vote', {
    p_skip_request_id: requestId,
    p_user_id: userId,
  })

  if (error) return { vetoed: false, error: new Error(error.message) }
  
  const result = data as { success: boolean; vetoed: boolean; error?: string }
  if (!result.success) {
    return { vetoed: false, error: new Error(result.error || 'Failed to cast veto vote') }
  }

  return { vetoed: result.vetoed, error: null }
}
