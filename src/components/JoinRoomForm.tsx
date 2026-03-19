'use client'

import { useState } from 'react'
import { joinRoom } from '../lib/rooms'
import { signInAnonymously } from '../lib/auth'
import { useStoredUsername } from '../hooks/useStoredUsername'

interface Props {
  initialCode?: string
  onJoined: (roomCode: string, sessionId: string) => void
}

export function JoinRoomForm({ initialCode = '', onJoined }: Props) {
  const [roomCode, setRoomCode] = useState(initialCode.toUpperCase())
  const [username, setUsername] = useStoredUsername()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomCode.trim() || !username.trim()) return

    setLoading(true)
    setError(null)

    const { user, error: authError } = await signInAnonymously()
    if (authError || !user) {
      setError('Failed to authenticate. Please try again.')
      setLoading(false)
      return
    }

    const { session, error: joinError } = await joinRoom({
      roomCode: roomCode.trim().toUpperCase(),
      username: username.trim(),
      userId: user.id,
    })

    if (joinError || !session) {
      setError(joinError?.message ?? 'Room not found. Check the code and try again.')
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
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan font-mono text-center text-2xl tracking-widest uppercase"
        />
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
          Your Name
        </label>
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
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || roomCode.length !== 6 || !username.trim()}
        className="w-full px-6 py-3 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Joining...' : 'Join Room'}
      </button>
    </form>
  )
}
