'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createRoom } from '../lib/rooms'
import { signInAnonymously, claimAnonymousUsername } from '../lib/auth'
import { useStoredUsername } from '../hooks/useStoredUsername'
import { useUsernameCheck } from '../hooks/useUsernameCheck'

interface Props {
  onRoomCreated: (roomCode: string, roomName: string) => void
}

export function CreateRoomForm({ onRoomCreated }: Props) {
  const [roomName, setRoomName] = useState('')
  const [username, setUsername, isLocked, isLoadingAuth, isAnonymous] = useStoredUsername()
  const { isAvailable, isChecking } = useUsernameCheck(username)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(true)
  const [password, setPassword] = useState('')
  const [skipVoteCount, setSkipVoteCount] = useState(2)
  const [allowedResources, setAllowedResources] = useState<'both' | 'youtube' | 'spotify'>('both')

  // If user is anonymous, they can't create private rooms
  useEffect(() => {
    if (isAnonymous) {
      setIsPublic(true)
    }
  }, [isAnonymous])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLoadingAuth) return // Wait for auth check before submitting
    if (!roomName.trim() || !username.trim()) return
    if (!isPublic && (isAnonymous || !password.trim())) {
      setError('Only registered users can create private rooms.')
      return
    }

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

    const { data, error: roomError } = await createRoom({
      name: roomName.trim(),
      hostId: user.id,
      username: username.trim(),
      isPublic,
      password: !isPublic ? password.trim() : undefined,
      skipVoteCount,
      allowedResources,
    })
    
    if (roomError || !data) {
      setError(roomError?.message ?? 'Failed to create room. Please try again.')
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
                placeholder="DJ Chaos"
                maxLength={30}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-pink"
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

      {/* Privacy toggle */}
      <div>
        <p className="block text-sm font-medium text-gray-300 mb-2">Room Privacy</p>
        <div className="flex gap-2">
          <button
            type="button"
            id="privacy-public"
            onClick={() => setIsPublic(true)}
            className={`flex-1 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              isPublic
                ? 'bg-neon-pink text-black border-neon-pink'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-neon-pink'
            }`}
          >
            🌐 Public
          </button>
          <button
            type="button"
            id="privacy-private"
            disabled={isAnonymous}
            onClick={() => {
              setIsPublic(false)
              if (!password) {
                const pin = Math.floor(10000 + Math.random() * 90000).toString()
                setPassword(pin)
              }
            }}
            className={`flex-1 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              !isPublic
                ? 'bg-neon-pink text-black border-neon-pink'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-neon-pink'
            } ${isAnonymous ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
          >
            🔒 Private
          </button>
        </div>
        {isAnonymous ? (
          <p className="text-xs text-neon-cyan mt-2 p-2 bg-neon-cyan/10 rounded border border-neon-cyan/20">
            Want to create private rooms?{' '}
            <Link href="/login" className="underline font-bold">
              Login or Register
            </Link>{' '}
            first.
          </p>
        ) : isPublic ? (
          <p className="text-xs text-gray-500 mt-1">Anyone with the room code can join.</p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">Only people with the room code AND password can join.</p>
        )}
      </div>

      {/* Password field – only shown for private rooms */}
      {!isPublic && (
        <div>
          <label htmlFor="roomPassword" className="block text-sm font-medium text-gray-300 mb-1">
            Room Password
          </label>
          <input
            id="roomPassword"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a password"
            maxLength={100}
            required={!isPublic}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-pink"
          />
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Search Resources */}
      <div>
        <p className="block text-sm font-medium text-gray-300 mb-2">Allowed Tracks</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAllowedResources('both')}
            className={`flex-1 px-2 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              allowedResources === 'both' ? 'bg-neon-cyan text-black border-neon-cyan' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-neon-cyan'
            }`}
          >
            Both
          </button>
          <button
            type="button"
            onClick={() => setAllowedResources('youtube')}
            className={`flex-1 px-2 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              allowedResources === 'youtube' ? 'bg-neon-cyan text-black border-neon-cyan' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-neon-cyan'
            }`}
          >
            YouTube
          </button>
          <button
            type="button"
            onClick={() => setAllowedResources('spotify')}
            className={`flex-1 px-2 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              allowedResources === 'spotify' ? 'bg-neon-cyan text-black border-neon-cyan' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-neon-cyan'
            }`}
          >
            Spotify
          </button>
        </div>
      </div>

      {/* Skip Vote Count */}
      <div>
        <label htmlFor="skipVoteCount" className="block text-sm font-medium text-gray-300 mb-1">
          Skip Vote Threshold
        </label>
        <input
          id="skipVoteCount"
          type="number"
          min="1"
          max="1000"
          value={skipVoteCount}
          onChange={(e) => setSkipVoteCount(Math.max(1, Number(e.target.value)))}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-neon-pink"
        />
        <p className="text-xs text-gray-500 mt-1">Number of votes needed to skip a track.</p>
      </div>

      <button
        type="submit"
        disabled={
          loading ||
          isLoadingAuth ||
          !roomName.trim() ||
          !username.trim() ||
          (!isLocked && isAvailable === false) ||
          (!isPublic && (isAnonymous || !password.trim()))
        }
        className="w-full px-6 py-3 bg-neon-pink text-black font-bold rounded-lg hover:bg-neon-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating...' : 'Create Room'}
      </button>
    </form>
  )
}
