/**
 * Room service - create, join, and manage rooms
 */

import { supabase } from './supabase'
// @ts-ignore
import { INITIAL_TOKEN_AIRDROP } from './schema'
import type { Room, Session } from '../types'

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // exclude confusing chars: 0,O,1,I
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

interface CreateRoomParams {
  name: string
  hostId: string
  username: string
  isPublic?: boolean
  password?: string
  skipVoteCount?: number
  allowedResources?: 'youtube' | 'spotify' | 'both'
}

interface CreateRoomResult {
  data: (Room & { code: string }) | null
  error: Error | null
}

export async function createRoom({ name, hostId, username, isPublic = true, password, skipVoteCount = 2, allowedResources = 'both' }: CreateRoomParams): Promise<CreateRoomResult> {
  const { data, error } = await supabase.rpc('create_room', {
    p_name: name,
    p_host_id: hostId,
    p_username: username,
    p_is_public: isPublic,
    p_password: !isPublic ? password : null,
    p_skip_vote_count: skipVoteCount,
    p_allowed_resources: allowedResources,
  })

  if (error) return { data: null, error: new Error(error.message) }

  const result = data as { room: Record<string, any>; session: Record<string, any> }
  const r = result.room

  return {
    data: {
      id: r.id,
      name: r.name,
      hostId: r.host_id,
      code: r.code,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isActive: r.is_active,
      isPublic: r.is_public,
      isPaused: r.is_paused,
      pausedAt: r.paused_at,
      skipVoteCount: r.skip_vote_count,
      allowedResources: r.allowed_resources,
    },
    error: null,
  }
}

interface JoinRoomParams {
  roomCode: string
  username: string
  userId: string
  password?: string
}

interface JoinRoomResult {
  session: Session | null
  room: (Room & { code: string }) | null
  error: Error | null
  requiresPassword?: boolean
}

export async function joinRoom({ roomCode, username, userId, password }: JoinRoomParams): Promise<JoinRoomResult> {
  // Use the secure RPC for all joins (handles public and private rooms)
  const { data, error } = await supabase.rpc('join_room', {
    p_room_code: roomCode.toUpperCase(),
    p_user_id: userId,
    p_username: username,
    p_password: password ?? null,
  })

  if (error) {
    return { session: null, room: null, error: new Error(error.message) }
  }

  const result = data as { error?: string; session?: Record<string, unknown>; room?: Record<string, unknown> }

  if (result?.error) {
    const requiresPassword = result.error === 'Incorrect password'
    return {
      session: null,
      room: null,
      error: new Error(result.error),
      requiresPassword,
    }
  }

  const s = result.session as Record<string, unknown>
  const r = result.room as Record<string, unknown>

  const session: Session = {
    id: s.id as string,
    roomId: s.room_id as string,
    userId: s.user_id as string,
    username: s.username as string,
    joinedAt: s.joined_at as string,
    tokens: s.tokens as number,
    isHost: s.is_host as boolean,
  }

  const room = {
    id: r.id as string,
    name: r.name as string,
    hostId: r.host_id as string,
    code: r.code as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    isActive: r.is_active as boolean,
    isPublic: r.is_public as boolean,
    isPaused: r.is_paused as boolean,
    pausedAt: r.paused_at as string | null,
    skipVoteCount: r.skip_vote_count as number,
    allowedResources: r.allowed_resources as 'youtube' | 'spotify' | 'both',
  }

  return { session, room, error: null }
}

export async function checkIfRoomIsPrivate(roomCode: string): Promise<{ isPrivate: boolean; error: Error | null }> {
  const { data, error } = await supabase
    .from('rooms')
    .select('is_public')
    .eq('code', roomCode.toUpperCase())
    .single()

  if (error || !data) {
    return { isPrivate: false, error: new Error(error?.message ?? 'Room not found') }
  }

  return { isPrivate: !data.is_public, error: null }
}

interface GetRoomResult {
  data: (Room & { code: string }) | null
  error: Error | null
}

export async function getRoomByCode(code: string): Promise<GetRoomResult> {
  const { data, error } = await supabase
    .from('rooms')
    .select()
    .eq('code', code)
    .single()

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? 'Not found') }
  }

  return {
    data: {
      id: data.id,
      name: data.name,
      hostId: data.host_id,
      code: data.code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isActive: data.is_active,
      isPublic: data.is_public,
      isPaused: data.is_paused,
      pausedAt: data.paused_at,
      skipVoteCount: data.skip_vote_count,
      allowedResources: data.allowed_resources,
    },
    error: null,
  }
}

export async function getRoomPassword(roomId: string): Promise<{ password: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('room_secrets')
    .select('password')
    .eq('room_id', roomId)
    .maybeSingle()

  if (error) return { password: null, error: new Error(error.message) }
  return { password: data?.password ?? null, error: null }
}

interface RoomListResult {
  rooms: (Room & { code: string })[]
  totalCount: number
  error: Error | null
}

export async function getPublicRooms({ search = '', page = 1, limit = 10 } = {}): Promise<RoomListResult> {
  let query = supabase
    .from('rooms')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, count, error } = await query.range(from, to)

  if (error) return { rooms: [], totalCount: 0, error: new Error(error.message) }

  return {
    rooms: (data || []).map(r => ({
      id: r.id,
      name: r.name,
      hostId: r.host_id,
      code: r.code,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isActive: r.is_active,
      isPublic: r.is_public,
      isPaused: r.is_paused,
      pausedAt: r.paused_at,
      skipVoteCount: r.skip_vote_count,
      allowedResources: r.allowed_resources,
    })),
    totalCount: count || 0,
    error: null,
  }
}

export async function getJoinedRooms({ userId, search = '', page = 1, limit = 10 }: { userId: string, search?: string, page?: number, limit?: number }): Promise<RoomListResult> {
  let query = supabase
    .from('sessions')
    .select('rooms (*)', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_host', false) // Only joined rooms, not owned
    .order('joined_at', { ascending: false })

  if (search) {
    // This is tricky because we filter sessions but want to search room name.
    // PostgREST doesn't support easy filtering on joined tables in select count without some hacks.
    // However, for MVP/Chaos Player, we can filter the rooms field.
    query = query.ilike('rooms.name', `%${search}%`)
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, count, error } = await query.range(from, to)

  if (error) return { rooms: [], totalCount: 0, error: new Error(error.message) }

  // Filter out any sessions where rooms didn't match the search (PostgREST returns null for rooms if it doesn't match ilike)
  const rooms = (data || [])
    .filter(s => s.rooms)
    .map((s: any) => ({
      id: s.rooms.id,
      name: s.rooms.name,
      hostId: s.rooms.host_id,
      code: s.rooms.code,
      createdAt: s.rooms.created_at,
      updatedAt: s.rooms.updated_at,
      isActive: s.rooms.is_active,
      isPublic: s.rooms.is_public,
      isPaused: s.rooms.is_paused,
      pausedAt: s.rooms.paused_at,
      skipVoteCount: s.rooms.skip_vote_count,
      allowedResources: s.rooms.allowed_resources,
    }))

  return {
    rooms,
    totalCount: count || 0,
    error: null,
  }
}

export async function getOwnedRooms({ userId, search = '', page = 1, limit = 10 }: { userId: string, search?: string, page?: number, limit?: number }): Promise<RoomListResult> {
  let query = supabase
    .from('rooms')
    .select('*', { count: 'exact' })
    .eq('host_id', userId)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, count, error } = await query.range(from, to)

  if (error) return { rooms: [], totalCount: 0, error: new Error(error.message) }

  return {
    rooms: (data || []).map(r => ({
      id: r.id,
      name: r.name,
      hostId: r.host_id,
      code: r.code,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isActive: r.is_active,
      isPublic: r.is_public,
      isPaused: r.is_paused,
      pausedAt: r.paused_at,
      skipVoteCount: r.skip_vote_count,
      allowedResources: r.allowed_resources,
    })),
    totalCount: count || 0,
    error: null,
  }
}
