'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerUser } from '../../lib/auth'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { isAvailable, isChecking } = useUsernameCheck(username)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    
    if (isAvailable === false) {
      setError('Username is already taken. Please choose another one.')
      return
    }

    setLoading(true)
    setError(null)

    const { user, error: regErr } = await registerUser(username.trim(), password)
    
    if (regErr || !user) {
      // Sometimes the error could still be username taken, let's show it
      setError(regErr?.message ?? 'Failed to register.')
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
        <h2 className="text-2xl font-bold text-white mb-6">Register</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
              Choose a Username
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                maxLength={30}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-pink"
              />
              {username.trim() && (
                <div className={`absolute right-3 top-2.5 text-sm ${isChecking ? 'text-gray-400' : isAvailable === false ? 'text-red-400' : isAvailable === true ? 'text-green-400' : ''}`}>
                  {isChecking ? 'Checking...' : isAvailable === false ? 'Taken' : isAvailable === true ? 'Available' : ''}
                </div>
              )}
            </div>
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
              minLength={6}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-pink"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password || isAvailable === false}
            className="w-full px-6 py-3 bg-neon-pink text-black font-bold rounded-lg hover:bg-neon-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <p className="mt-6 text-gray-400 text-sm text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-neon-pink hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </main>
  )
}
