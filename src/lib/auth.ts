/**
 * Anonymous authentication via Supabase
 */

import { supabase } from './supabase'

export interface AnonymousUser {
  id: string
}

export async function signInAnonymously(): Promise<{ user: AnonymousUser | null; error: Error | null }> {
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) return { user: null, error: new Error(error.message) }
  if (!data.user) return { user: null, error: new Error('Failed to create anonymous user') }

  return { user: { id: data.user.id }, error: null }
}

export async function getCurrentUser(): Promise<AnonymousUser | null> {
  const { data } = await supabase.auth.getUser()
  return data.user ? { id: data.user.id } : null
}
