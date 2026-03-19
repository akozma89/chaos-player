/**
 * Anonymous authentication via Supabase
 */

import { supabase } from './supabase'

export interface AnonymousUser {
  id: string
}

export async function syncAuthCookies() {
  if (typeof document === 'undefined') return
  
  const { data: sessionData } = await supabase.auth.getSession()
  const { data: userData } = await supabase.auth.getUser()
  
  if (userData?.user) {
    document.cookie = `chaos_user_id=${userData.user.id}; path=/; max-age=31536000`
  }
  if (sessionData?.session) {
    document.cookie = `chaos_access_token=${sessionData.session.access_token}; path=/; max-age=31536000`
  }
}

export async function signInAnonymously(): Promise<{ user: AnonymousUser | null; error: Error | null }> {
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) return { user: null, error: new Error(error.message) }
  if (!data.user) return { user: null, error: new Error('Failed to create anonymous user') }

  await syncAuthCookies();

  return { user: { id: data.user.id }, error: null }
}

export async function getCurrentUser(): Promise<AnonymousUser | null> {
  const { data } = await supabase.auth.getUser()
  await syncAuthCookies();
  return data.user ? { id: data.user.id } : null
}
