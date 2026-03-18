/**
 * Room service - create, join, and manage rooms
 */

import { supabase } from './supabase'
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
}

interface CreateRoomResult {
  data: (Room & { code: string }) | null
  error: Error | null
}

export async function createRoom({ name, hostId, username }: CreateRoomParams): Promise<CreateRoomResult> {
  const code = generateRoomCode()

  const { data, error } = await supabase
    .from('rooms')
    .insert({ name, host_id: hostId, code, is_active: true })
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }

  // Register host as a session member so RLS policies (queue insert, etc.) apply
  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      room_id: data.id,
      user_id: hostId,
      username,
      tokens: INITIAL_TOKEN_AIRDROP,
      is_host: true,
    })

  if (sessionError) return { data: null, error: new Error(sessionError.message) }

  return {
    data: {
      id: data.id,
      name: data.name,
      hostId: data.host_id,
      code: data.code,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isActive: data.is_active,
    },
    error: null,
  }
}

interface JoinRoomParams {
  roomCode: string
  username: string
  userId: string
}

interface JoinRoomResult {
  session: Session | null
  room: (Room & { code: string }) | null
  error: Error | null
}

export async function joinRoom({ roomCode, username, userId }: JoinRoomParams): Promise<JoinRoomResult> {
  // Look up room by code
  const { data: roomData, error: roomError } = await supabase
    .from('rooms')
    .select()
    .eq('code', roomCode)
    .single()

  if (roomError || !roomData) {
    return { session: null, room: null, error: new Error(roomError?.message ?? 'Room not found') }
  }

  // Create session with token airdrop
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      room_id: roomData.id,
      user_id: userId,
      username,
      tokens: INITIAL_TOKEN_AIRDROP,
      is_host: false,
    })
    .select()
    .single()

  if (sessionError) {
    return { session: null, room: null, error: new Error(sessionError.message) }
  }

  const session: Session = {
    id: sessionData.id,
    roomId: sessionData.room_id,
    userId: sessionData.user_id,
    username: sessionData.username,
    joinedAt: sessionData.joined_at,
    tokens: sessionData.tokens,
    isHost: sessionData.is_host,
  }

  const room = {
    id: roomData.id,
    name: roomData.name,
    hostId: roomData.host_id,
    code: roomData.code,
    createdAt: roomData.created_at,
    updatedAt: roomData.updated_at,
    isActive: roomData.is_active,
  }

  return { session, room, error: null }
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
    },
    error: null,
  }
}
