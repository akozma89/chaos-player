'use client'

import { useState } from 'react'
import { joinRoom, checkIfRoomIsPrivate } from '../lib/rooms'
import { signInAnonymously, claimAnonymousUsername } from '../lib/auth'
import { useStoredUsername } from '../hooks/useStoredUsername'
import { useUsernameCheck } from '../hooks/useUsernameCheck'

interface Props {
  initialCode?: string
  onJoined: (roomCode: string, sessionId: string) => void
}

export function JoinRoomForm({ initialCode = '', onJoined }: Props) {
  const [roomCode, setRoomCode] = useState(initialCode.toUpperCase())
  const [username, setUsername, isLocked, isLoadingAuth, _isAnonymous] = useStoredUsername()
  const { isAvailable, isChecking } = useUsernameCheck(username)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Private room state
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLoadingAuth) return
    if (!roomCode.trim() || !username.trim()) return

    setLoading(true)
    setError(null)

    const { user, error: authError } = await signInAnonymously()
    if (authError || !user) {
      setError('Failed to authenticate. Please try again.')
      setLoading(false)
      return
    }

    if (!isLocked) {
      const { success, error: claimError } = await claimAnonymousUsername(username.trim())
      if (!success) {
        setError(claimError?.message ?? 'Username is already taken.')
        setLoading(false)
        return
      }
    }

    // If we haven't shown the password field yet, check if this room requires one
    if (!needsPassword) {
      const { isPrivate, error: checkError } = await checkIfRoomIsPrivate(roomCode.trim())
      if (checkError) {
        setError('Room not found. Check the code and try again.')
        setLoading(false)
        return
      }
      if (isPrivate) {
        // Show password field and wait for re-submission
        setNeedsPassword(true)
        setLoading(false)
        return
      }
    }

    const { session, error: joinError } = await joinRoom({
      roomCode: roomCode.trim().toUpperCase(),
      username: username.trim(),
      userId: user.id,
      password: needsPassword ? password.trim() : undefined,
    })

    if (joinError || !session) {
      const msg = joinError?.message ?? 'Could not join room.'
      if (msg === 'Incorrect password') {
        setError('Incorrect password. Please try again.')
      } else {
        setError(msg)
      }
      setLoading(false)
      return
    }

    onJoined(roomCode.trim().toUpperCase(), session.id)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div>
        <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300 mb-1">
          Room Code
        </label>
        <input
          id="roomCode"
          type="text"
          value={roomCode}
          onChange={(e) => {
            setRoomCode(e.target.value.toUpperCase())
            // Reset password state if the user changes the code
            setNeedsPassword(false)
            setPassword('')
          }}
          placeholder="ABC123"
          maxLength={6}
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan font-mono text-center text-2xl tracking-widest uppercase"
        />
      </div>

      {!isLocked && (
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
            Your Name
          </label>
          {isLoadingAuth ? (
            <div className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-500 animate-pulse">
              Loading...
            </div>
          ) : (
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Guest"
                maxLength={30}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
              />
              {username.trim() && (
                <div className={`absolute right-3 top-2.5 text-sm ${isChecking ? 'text-gray-400' : isAvailable === false ? 'text-red-400' : isAvailable === true ? 'text-green-400' : ''}`}>
                  {isChecking ? 'Checking...' : isAvailable === false ? 'Taken?' : isAvailable === true ? 'Available' : ''}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Password field – shown dynamically when private room is detected */}
      {needsPassword && (
        <div>
          <label htmlFor="joinPassword" className="block text-sm font-medium text-gray-300 mb-1">
            🔒 Room Password
          </label>
          <p className="text-xs text-gray-500 mb-2">This room is private. Enter the password to join.</p>
          <input
            id="joinPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter room password"
            maxLength={100}
            required
            autoFocus
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
          />
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={
          loading ||
          isLoadingAuth ||
          roomCode.length !== 6 ||
          !username.trim() ||
          (!isLocked && isAvailable === false) ||
          (needsPassword && !password.trim())
        }
        className="w-full px-6 py-3 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? needsPassword
            ? 'Verifying...'
            : 'Checking...'
          : needsPassword
            ? 'Enter Room'
            : 'Join Room'}
      </button>
    </form>
  )
}
