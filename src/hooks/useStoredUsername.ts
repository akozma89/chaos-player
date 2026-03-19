'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'chaos_username'

export function useStoredUsername() {
  const [username, setUsernameState] = useState('')

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setUsernameState(stored)
  }, [])

  const setUsername = useCallback((value: string) => {
    setUsernameState(value)
    if (value.trim()) {
      localStorage.setItem(STORAGE_KEY, value)
    }
  }, [])

  return [username, setUsername] as const
}
