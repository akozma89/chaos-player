'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CreateRoomForm } from '../components/CreateRoomForm'
import { JoinRoomForm } from '../components/JoinRoomForm'
import { RoomList } from '../components/RoomList'
import { getCurrentUser, signOut, AppUser } from '../lib/auth'

type View = 'home' | 'create' | 'join'

export default function Home() {
  const [view, setView] = useState<View>('home')
  const [user, setUser] = useState<AppUser | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [search, setSearch] = useState('')

  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then(u => {
      setUser(u)
      setLoadingAuth(false)
    })
  }, [])

  async function handleLogout() {
    await signOut()
    setUser(null)
    localStorage.removeItem('chaos_username')
  }

  function handleRoomCreated(code: string, _name: string) {
    router.push(`/room/${code}?t=${Date.now()}`)
  }

  function handleJoined(code: string, _sessionId: string) {
    router.push(`/room/${code}?t=${Date.now()}`)
  }

  if (view === 'create') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-white mb-6 text-sm">
            ← Back
          </button>
          <h2 className="text-2xl font-bold text-white mb-6">Create a Room</h2>
          <CreateRoomForm onRoomCreated={handleRoomCreated} />
        </div>
      </main>
    )
  }

  if (view === 'join') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-white mb-6 text-sm">
            ← Back
          </button>
          <h2 className="text-2xl font-bold text-white mb-6">Join a Room</h2>
          <JoinRoomForm onJoined={handleJoined} />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4">
          <span className="bg-gradient-to-r from-neon-pink via-neon-purple to-neon-cyan bg-clip-text text-transparent">
            Chaos
          </span>
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Democratic Music Player for Social Gatherings
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={() => setView('create')}
            className="px-8 py-3 bg-neon-pink text-black font-bold rounded-lg hover:bg-neon-cyan transition-colors"
          >
            Create Room
          </button>
          <button
            onClick={() => setView('join')}
            className="px-8 py-3 border-2 border-neon-cyan text-neon-cyan font-bold rounded-lg hover:bg-neon-cyan hover:text-black transition-colors"
          >
            Join Room
          </button>
        </div>

        {loadingAuth ? (
          <div className="text-gray-500 text-sm animate-pulse">Checking auth state...</div>
        ) : user && user.username ? (
          <div className="flex flex-col items-center gap-2">
            <div className="text-gray-400 text-sm flex items-center justify-center gap-2">
              <span>{user.is_anonymous ? 'Playing as' : 'Logged in as'} <strong className="text-white">{user.username}</strong></span>
              <span className="text-gray-600">|</span>
              <button onClick={handleLogout} className="text-neon-pink hover:underline">Logout</button>
            </div>
            {user.is_anonymous && (
              <Link 
                href={`/register?username=${encodeURIComponent(user.username)}`}
                className="text-xs bg-neon-cyan/10 text-neon-cyan px-3 py-1 rounded-full border border-neon-cyan/20 hover:bg-neon-cyan/20 transition-colors"
              >
                ✨ Reserve this name (set password)
              </Link>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-sm">
            Want to reserve your name?{' '}
            <Link href="/login" className="text-neon-cyan hover:underline">
              Login or Register
            </Link>
          </div>
        )}
      </div>

      <div className="w-full max-w-6xl">
        <div className="mb-8 relative max-w-md mx-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple transition-colors"
          />
          <span className="absolute right-4 top-3.5 text-gray-500">🔍</span>
        </div>

        {loadingAuth ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !user ? (
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-neon-cyan">🌐</span> Public Rooms
            </h2>
            <RoomList type="public" search={search} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col h-full">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-neon-cyan">🌐</span> Public Rooms
              </h2>
              <div className="flex-1 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <RoomList type="public" search={search} />
              </div>
            </div>

            <div className="flex flex-col h-full">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-neon-pink">🎧</span> Joined Rooms
              </h2>
              <div className="flex-1 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <RoomList type="joined" userId={user.id} search={search} />
              </div>
            </div>

            <div className="flex flex-col h-full">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-neon-purple">👑</span> Owned Rooms
              </h2>
              <div className="flex-1 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <RoomList type="owned" userId={user.id} search={search} />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
