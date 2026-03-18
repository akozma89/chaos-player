'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueue } from '../../../hooks/useQueue';
import { getCurrentUser, signInAnonymously } from '../../../lib/auth';
import { Queue } from '../../../components/Queue';
import Leaderboard from '../../../components/Leaderboard';
import { NowPlaying } from '../../../components/NowPlaying';

const RoomPage = () => {
  const { code } = useParams();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const roomId = code as string;

  useEffect(() => {
    const initAuth = async () => {
      let user = await getCurrentUser();
      if (!user) {
        const { user: newUser, error } = await signInAnonymously();
        if (error) {
          console.error('Failed to sign in:', error);
          return;
        }
        user = newUser;
      }
      if (user) {
        setUserId(user.id);
      }
    };
    initAuth();
  }, []);

  const { playing, items, loading, error, advanceQueue } = useQueue(roomId, userId || '');

  if (!userId || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-2xl animate-pulse text-neon-blue">
          {!userId ? 'Authenticating...' : 'Loading Room...'}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-xl text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="text-zinc-500 hover:text-white transition"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-neon-pink tracking-tighter">
              ROOM <span className="text-white">/</span> {code}
            </h1>
          </div>
          <div className="px-4 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20 text-neon-blue font-mono text-sm">
            {items.length} TRACKS
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Now Playing & Main Player */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/30 rounded-2xl p-1 border border-white/5 shadow-2xl">
              <NowPlaying 
                currentTrack={playing}
                queue={items}
                isHost={true} // For MVP, everyone can be a host or we'll refine later
                userId={userId}
                onTrackChange={() => advanceQueue()}
              />
            </div>
          </div>

          {/* Right Column: Queue & Leaderboard */}
          <div className="space-y-8">
            <section className="bg-zinc-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-neon-green rounded-full block" />
                UP NEXT
              </h2>
              <Queue roomId={roomId} userId={userId} />
            </section>

            <section className="bg-zinc-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-neon-pink rounded-full block" />
                TOP CONTRIBUTORS
              </h2>
              <Leaderboard roomId={roomId} />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RoomPage;
