'use client'

import { useParams, useRouter } from 'next/navigation'
import { JoinRoomForm } from '../../../../components/JoinRoomForm'

export default function JoinRoomPage() {
  const { code } = useParams()
  const router = useRouter()

  function handleJoined(joinedCode: string, _sessionId: string) {
    router.push(`/room/${joinedCode}?t=${Date.now()}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-black text-white">
      <div className="w-full max-w-sm">
        <button 
          onClick={() => router.push('/')} 
          className="text-gray-400 hover:text-white mb-6 text-sm transition"
        >
          ← Back to Home
        </button>
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Join Room <span className="text-neon-cyan">{code}</span>
        </h2>
        <JoinRoomForm initialCode={code as string} onJoined={handleJoined} />
      </div>
    </main>
  )
}
