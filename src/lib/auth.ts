/**
 * Authentication via Supabase (Anonymous & Registered)
 */

import { supabase } from './supabase'

export interface AppUser {
  id: string
  username?: string
  is_anonymous?: boolean
}

const EMAIL_DOMAIN = '@chaos-player.local'

export async function syncAuthCookies() {
  if (typeof document === 'undefined') return
  
  const { data: sessionData } = await supabase.auth.getSession()
  const { data: userData } = await supabase.auth.getUser()
  
  if (userData?.user) {
    document.cookie = `chaos_user_id=${userData.user.id}; path=/; max-age=31536000`
  } else {
    document.cookie = `chaos_user_id=; path=/; max-age=0`
  }
  
  if (sessionData?.session) {
    document.cookie = `chaos_access_token=${sessionData.session.access_token}; path=/; max-age=31536000`
  } else {
    document.cookie = `chaos_access_token=; path=/; max-age=0`
  }
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()
  
  if (error && error.code === 'PGRST116') {
    // No rows returned
    return true;
  }
  return false;
}

export async function signInAnonymously(): Promise<{ user: AppUser | null; error: Error | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    return { user: { id: session.user.id, is_anonymous: session.user.is_anonymous }, error: null };
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) return { user: null, error: new Error(error.message) }
  if (!data.user) return { user: null, error: new Error('Failed to create anonymous user') }

  await syncAuthCookies();
  return { user: { id: data.user.id, is_anonymous: true }, error: null }
}

export async function claimAnonymousUsername(username: string): Promise<{ success: boolean; error: Error | null }> {
  // Check if we are logged in
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: new Error('Not authenticated') }

  // Check if the username is already taken
  const isAvailable = await checkUsernameAvailable(username);
  
  if (!isAvailable) {
    // Check if it's already ours
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .eq('id', user.id)
      .single()
      
    if (myProfile) return { success: true, error: null }
    return { success: false, error: new Error('Username already taken') }
  }
  
  // Create or update our profile
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, username, is_anonymous: true }, { onConflict: 'id' })
    
  if (error) return { success: false, error: new Error(error.message) }
  return { success: true, error: null }
}

export async function registerUser(username: string, password: string): Promise<{ user: AppUser | null; error: Error | null }> {
  const email = `${username.toLowerCase()}${EMAIL_DOMAIN}`
  
  // Call signup
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  // Note: if user already exists (same email), supabase might not return an error depending on settings,
  // but we should have already checked username availability at the UI level.
  // Assuming our unique constraint catches it.

  if (error) return { user: null, error: new Error(error.message) }
  if (!data.user) return { user: null, error: new Error('Failed to create user') }

  // Insert profile over whatever existed, with correct username capitalization
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: data.user.id, username, is_anonymous: false }, { onConflict: 'id' })

  if (profileError) return { user: null, error: new Error(profileError.message) }
  
  await syncAuthCookies();
  return { user: { id: data.user.id, username, is_anonymous: false }, error: null }
}

export async function loginUser(username: string, password: string): Promise<{ user: AppUser | null; error: Error | null }> {
  const email = `${username.toLowerCase()}${EMAIL_DOMAIN}`
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) return { user: null, error: new Error(error.message) }
  if (!data.user) return { user: null, error: new Error('Failed to login user') }
  
  await syncAuthCookies();
  return { user: { id: data.user.id, username, is_anonymous: false }, error: null }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const { data } = await supabase.auth.getUser()
  await syncAuthCookies();
  
  if (!data.user) return null;
  
  // Try to get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, is_anonymous')
    .eq('id', data.user.id)
    .single()
    
  return {
    id: data.user.id,
    username: profile?.username,
    is_anonymous: profile ? profile.is_anonymous : data.user.is_anonymous
  }
}

export async function signOut() {
  await supabase.auth.signOut()
  await syncAuthCookies()
}
