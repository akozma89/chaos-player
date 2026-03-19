'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { exchangeCodeForTokens } from '../../../../lib/spotify'
import { saveSession } from '../../../../lib/spotifySession'

function SpotifyCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'error'>('processing')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      if (error) {
        setErrorMsg(`Spotify authorization denied: ${error}`)
        setStatus('error')
        return
      }

      if (!code) {
        setErrorMsg('No authorization code received from Spotify.')
        setStatus('error')
        return
      }

      // Validate state to prevent CSRF
      const storedState = sessionStorage.getItem('spotify_pkce_state')
      if (state !== storedState) {
        setErrorMsg('State mismatch — possible CSRF attempt.')
        setStatus('error')
        return
      }

      const verifier = sessionStorage.getItem('spotify_pkce_verifier')
      if (!verifier) {
        setErrorMsg('PKCE verifier missing from session. Please try connecting again.')
        setStatus('error')
        return
      }

      const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? ''
      const redirectUri = window.location.origin + '/auth/spotify/callback'

      const result = await exchangeCodeForTokens({ code, codeVerifier: verifier, clientId, redirectUri })

      if (result.error || !result.accessToken) {
        setErrorMsg(result.error?.message ?? 'Failed to exchange authorization code.')
        setStatus('error')
        return
      }

      saveSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? '',
        expiresAt: Date.now() + (result.expiresIn ?? 3600) * 1000,
      })

      // Clean up PKCE artifacts
      sessionStorage.removeItem('spotify_pkce_verifier')
      sessionStorage.removeItem('spotify_pkce_state')

      // Redirect back — try referrer, fall back to home
      const returnTo = document.referrer || '/'
      router.replace(returnTo)
    }

    handleCallback()
  }, [router, searchParams])

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="max-w-md w-full mx-4 p-6 bg-zinc-900 border border-red-500/20 rounded-2xl text-center space-y-4">
          <p className="text-red-400 text-lg">{errorMsg}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-zinc-800 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition text-sm"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-neon-green/30 border-t-neon-green rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Connecting Spotify...</p>
      </div>
    </div>
  )
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="w-8 h-8 border-2 border-neon-green/30 border-t-neon-green rounded-full animate-spin" />
        </div>
      }
    >
      <SpotifyCallbackInner />
    </Suspense>
  )
}
