'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreateRoomForm } from '../components/CreateRoomForm'
import { JoinRoomForm } from '../components/JoinRoomForm'

type View = 'home' | 'create' | 'join'

export default function Home() {
  const [view, setView] = useState<View>('home')

  const router = useRouter()

  function handleRoomCreated(code: string, _name: string) {
    // Navigate to room page with cache-buster to prevent Next.js from caching previous redirect loop
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
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">
          <span className="bg-gradient-to-r from-neon-pink via-neon-purple to-neon-cyan bg-clip-text text-transparent">
            Chaos
          </span>
        </h1>
        <p className="text-xl text-gray-400 mb-10">
          Democratic Music Player for Social Gatherings
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
      </div>
    </main>
  )
}
