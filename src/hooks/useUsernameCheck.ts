import { useState, useEffect } from 'react'
import { checkUsernameAvailable } from '../lib/auth'

export function useUsernameCheck(username: string) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (!username.trim()) {
      setIsAvailable(null)
      setIsChecking(false)
      return
    }

    setIsChecking(true)
    setIsAvailable(null)

    const timeoutId = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username.trim())
        setIsAvailable(available)
      } catch (e) {
        setIsAvailable(null)
      } finally {
        setIsChecking(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [username])

  return { isAvailable, isChecking }
}
