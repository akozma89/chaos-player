'use client'

import { useState } from 'react'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildSpotifyAuthUrl,
} from '../lib/spotify'
import { loadSession, clearSession } from '../lib/spotifySession'

interface ConnectSpotifyProps {
  clientId: string
  redirectUri?: string
  onConnected: (accessToken: string) => void
  onDisconnected: () => void
}

export default function ConnectSpotify({
  clientId,
  redirectUri,
  onConnected: _onConnected,
  onDisconnected,
}: ConnectSpotifyProps) {
  const [isConnected, setIsConnected] = useState(() => {
    const session = loadSession()
    return session !== null
  })
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    setIsConnecting(true)
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    const state = Math.random().toString(36).slice(2)

    sessionStorage.setItem('spotify_pkce_verifier', verifier)
    sessionStorage.setItem('spotify_pkce_state', state)

    const url = buildSpotifyAuthUrl({
      clientId,
      redirectUri: redirectUri ?? window.location.origin + '/auth/spotify/callback',
      codeChallenge: challenge,
      state,
    })

    window.location.assign(url)
  }

  const handleDisconnect = () => {
    clearSession()
    setIsConnected(false)
    onDisconnected()
  }

  if (isConnected) {
    return (
      <button
        onClick={handleDisconnect}
        className="w-full px-4 py-2.5 bg-neon-green/10 border border-neon-green/20 rounded-lg text-neon-green text-sm font-semibold hover:bg-neon-green/20 transition"
      >
        ✓ Spotify Connected — Disconnect
      </button>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-lg text-white text-sm font-semibold hover:bg-zinc-700 transition flex items-center justify-center gap-2"
    >
      {isConnecting ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-neon-green" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      )}
      Connect Spotify
    </button>
  )
}
