'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueue } from '../../../hooks/useQueue';
import { getCurrentUser, signInAnonymously } from '../../../lib/auth';
import { getRoomByCode } from '../../../lib/rooms';
import { Queue } from '../../../components/Queue';
import Leaderboard from '../../../components/Leaderboard';
import { NowPlaying } from '../../../components/NowPlaying';
import { WinnerToast } from '../../../components/WinnerToast';
import YouTubeSearch from '../../../components/YouTubeSearch';
import { AutoplayGuard } from '../../../components/AutoplayGuard';
import { TokenEarnNotification } from '../../../components/TokenEarnNotification';

const RoomPage = () => {
  const { code } = useParams();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const [showWinnerToast, setShowWinnerToast] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      // Resolve room UUID from the 6-char code in the URL
      const { data: room, error: roomError } = await getRoomByCode(code as string);
      if (roomError || !room) {
        console.error('Room not found:', roomError);
        router.push('/');
        return;
      }
      setRoomId(room.id);

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
  }, [code, router]);

  const { playing, items, pending, loading, error, vote, userVotes, recentReward, refresh } = useQueue(roomId || '', userId || '');

  // Winner Notification Logic
  // Use a ref for lastTrackId so updates don't trigger re-renders/effect re-runs.
  // Dependency on playing?.id (not the full object) prevents false triggers from
  // realtime vote updates that refresh playing with a new object but same track ID.
  useEffect(() => {
    if (!playing) return;
    const prevId = lastTrackIdRef.current;
    if (playing.id === prevId) return;

    lastTrackIdRef.current = playing.id;

    if (prevId !== null) {
      setShowWinnerToast(true);
      const timer = setTimeout(() => setShowWinnerToast(false), 8000);
      return () => clearTimeout(timer);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing?.id]);

  if (!userId || !roomId || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-2xl animate-pulse text-neon-blue">
          {!roomId ? 'Finding Room...' : !userId ? 'Authenticating...' : 'Loading Room...'}
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
      {!hasInteracted && (
        <AutoplayGuard onInteract={() => {
          setHasInteracted(true);
          refresh();
        }} />
      )}
      {recentReward && (
        <TokenEarnNotification 
          amount={recentReward.amount} 
          userId={recentReward.userId} 
          currentUserId={userId} 
        />
      )}
      {showWinnerToast && playing && (
        <WinnerToast 
          winner={playing} 
          onDismiss={() => setShowWinnerToast(false)} 
        />
      )}

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
                onTrackChange={() => refresh()}
              />
            </div>
          </div>

          {/* Right Column: Queue & Leaderboard */}
          <div className="space-y-8">
            <section className="relative z-10 bg-zinc-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-neon-blue rounded-full block" />
                ADD TRACK
              </h2>
              <YouTubeSearch roomId={roomId} userId={userId} />
            </section>

            <section className="bg-zinc-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-neon-green rounded-full block" />
                UP NEXT
              </h2>
              <Queue items={pending} userVotes={userVotes} loading={loading} error={error} vote={vote} />
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
