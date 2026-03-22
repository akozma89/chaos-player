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
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 text-sm flex items-center gap-2 w-fit transition-colors">
          <span>←</span> Back to Home
        </Link>
        
        <div className="flex mb-8 border-b border-gray-800">
          <div className="flex-1 pb-3 text-center border-b-2 border-neon-cyan text-2xl font-bold text-white">
            Login
          </div>
          <Link 
            href="/register" 
            className="flex-1 pb-3 text-center border-b-2 border-transparent text-2xl font-bold text-gray-500 hover:text-gray-300 transition-colors"
          >
            Register
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              maxLength={30}
              required
              className="w-full px-4 py-3 bg-gray-950/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 bg-gray-950/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan transition-all"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full px-6 py-3.5 bg-neon-cyan text-black font-bold rounded-xl hover:bg-neon-pink focus:outline-none focus:ring-2 focus:ring-neon-pink/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_20px_rgba(255,105,180,0.5)] flex justify-center items-center"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                Logging in...
              </span>
            ) : (
              'Login to your account'
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
