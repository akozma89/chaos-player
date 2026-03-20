'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginUser } from '../../lib/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return

    setLoading(true)
    setError(null)

    const { user, error: loginErr } = await loginUser(username.trim(), password)
    
    if (loginErr || !user) {
      setError(loginErr?.message ?? 'Invalid login credentials.')
      setLoading(false)
      return
    }

    // Redirect to home page
    router.push('/')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 text-sm block">
          ← Back to Home
        </Link>
        <h2 className="text-2xl font-bold text-white mb-6">Login</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              maxLength={30}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full px-6 py-3 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p className="mt-6 text-gray-400 text-sm text-center">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-neon-cyan hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </main>
  )
}
