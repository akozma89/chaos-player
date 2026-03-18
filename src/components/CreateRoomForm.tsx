'use client'

import { useState } from 'react'
import { createRoom } from '../lib/rooms'
import { signInAnonymously } from '../lib/auth'

interface Props {
  onRoomCreated: (roomCode: string, roomName: string) => void
}

export function CreateRoomForm({ onRoomCreated }: Props) {
  const [roomName, setRoomName] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomName.trim() || !username.trim()) return

    setLoading(true)
    setError(null)

    const { user, error: authError } = await signInAnonymously()
    if (authError || !user) {
      setError('Failed to authenticate. Please try again.')
      setLoading(false)
      return
    }

    const { data, error: roomError } = await createRoom({ name: roomName.trim(), hostId: user.id, username: username.trim() })
    if (roomError || !data) {
      setError('Failed to create room. Please try again.')
      setLoading(false)
      return
    }

    onRoomCreated(data.code, data.name)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div>
        <label htmlFor="roomName" className="block text-sm font-medium text-gray-300 mb-1">
          Room Name
        </label>
        <input
          id="roomName"
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Friday Night Vibes"
          maxLength={50}
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-pink"
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
          placeholder="DJ Chaos"
          maxLength={30}
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-pink"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !roomName.trim() || !username.trim()}
        className="w-full px-6 py-3 bg-neon-pink text-black font-bold rounded-lg hover:bg-neon-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating...' : 'Create Room'}
      </button>
    </form>
  )
}
