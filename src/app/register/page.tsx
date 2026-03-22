'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { registerUser, upgradeAnonymousUser, getCurrentUser } from '../../lib/auth'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'

function RegisterForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isUpgrade, setIsUpgrade] = useState(false)
  const { isAvailable, isChecking } = useUsernameCheck(username)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const prefilled = searchParams.get('username')
    if (prefilled) {
      setUsername(prefilled)
    }

    getCurrentUser().then(user => {
      if (user && user.is_anonymous) {
        setIsUpgrade(true)
        if (user.username) {
          setUsername(user.username)
        }
      }
    })
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    
    // If upgrading, we don't need to check availability because it's already ours
    if (!isUpgrade && isAvailable === false) {
      setError('Username is already taken. Please choose another one.')
      return
    }

    setLoading(true)
    setError(null)

    let result;
    if (isUpgrade) {
      result = await upgradeAnonymousUser(password)
    } else {
      result = await registerUser(username.trim(), password)
    }
    
    const { user, error: regErr } = result
    
    if (regErr || !user) {
      setError(regErr?.message ?? 'Failed to register.')
      setLoading(false)
      return
    }

    // Redirect to home page
    router.push('/')
  }

  return (
    <div className="w-full max-w-md bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
      <Link href="/" className="text-gray-400 hover:text-white mb-6 text-sm flex items-center gap-2 w-fit transition-colors">
        <span>←</span> Back to Home
      </Link>
      
      {!isUpgrade ? (
        <div className="flex mb-8 border-b border-gray-800">
          <Link 
            href="/login" 
            className="flex-1 pb-3 text-center border-b-2 border-transparent text-2xl font-bold text-gray-500 hover:text-gray-300 transition-colors"
          >
            Login
          </Link>
          <div className="flex-1 pb-3 text-center border-b-2 border-neon-pink text-2xl font-bold text-white">
            Register
          </div>
        </div>
      ) : (
        <h2 className="text-2xl font-bold text-white mb-2">
          Keep your name: {username}
        </h2>
      )}
      
      <p className={`text-gray-400 text-sm ${!isUpgrade ? 'mb-6 text-center' : 'mb-6'}`}>
        {isUpgrade 
          ? 'Set a password to secure your account and name permanently.' 
          : 'Choose a name and password to start your musical journey.'}
      </p>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-2">
            Username
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              maxLength={30}
              required
              disabled={isUpgrade}
              className={`w-full px-4 py-3 bg-gray-950/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-neon-pink/50 focus:border-neon-pink transition-all ${isUpgrade ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {!isUpgrade && username.trim() && (
              <div className={`absolute right-4 top-3 text-sm font-medium ${isChecking ? 'text-gray-400' : isAvailable === false ? 'text-red-400' : isAvailable === true ? 'text-green-400' : ''}`}>
                {isChecking ? 'Checking...' : isAvailable === false ? 'Taken' : isAvailable === true ? 'Available' : ''}
              </div>
            )}
          </div>
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
            minLength={6}
            className="w-full px-4 py-3 bg-gray-950/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-neon-pink/50 focus:border-neon-pink transition-all"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim() || !password || (!isUpgrade && isAvailable === false)}
          className="w-full px-6 py-3.5 bg-neon-pink text-black font-bold rounded-xl hover:bg-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_0_15px_rgba(255,105,180,0.3)] hover:shadow-[0_0_20px_rgba(0,255,255,0.5)] flex justify-center items-center"
        >
          {loading ? (
             <span className="flex items-center gap-2">
               <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
               Processing...
             </span>
          ) : isUpgrade ? 'Secure Account' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  )
}
