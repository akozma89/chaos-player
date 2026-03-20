'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '../lib/auth'

const STORAGE_KEY = 'chaos_username'

export function useStoredUsername() {
  const [username, setUsernameState] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getCurrentUser()
        if (user) {
          setIsAnonymous(user.is_anonymous ?? true)
          if (user.username) {
            setUsernameState(user.username)
            setIsLocked(true) // Lock if they are logged in and have a username
          } else {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) setUsernameState(stored)
          }
        } else {
          // Hydrate from localStorage if not logged in
          const stored = localStorage.getItem(STORAGE_KEY)
          if (stored) setUsernameState(stored)
        }
      } catch (err) {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) setUsernameState(stored)
      } finally {
        setIsLoadingAuth(false)
      }
    }
    loadUser()
  }, [])

  const setUsername = useCallback((value: string) => {
    if (isLocked) return
    setUsernameState(value)
    if (value.trim()) {
      localStorage.setItem(STORAGE_KEY, value)
    }
  }, [isLocked])

  return [username, setUsername, isLocked, isLoadingAuth, isAnonymous] as const
}
