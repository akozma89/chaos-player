'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueue } from '../../../hooks/useQueue';
import { addToQueue } from '../../../lib/queue';
import { Queue } from '../../../components/Queue';
import Leaderboard from '../../../components/Leaderboard';
import { NowPlaying } from '../../../components/NowPlaying';
import { WinnerToast } from '../../../components/WinnerToast';
import YouTubeSearch from '../../../components/YouTubeSearch';
import SpotifySearch from '../../../components/SpotifySearch';
import { TokenEarnNotification } from '../../../components/TokenEarnNotification';

const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? ''

interface RoomClientProps {
  room: {
    id: string;
    name: string;
    code: string;
  };
  userId: string;
}

const RoomClient = ({ room, userId }: RoomClientProps) => {
  const router = useRouter();
  const [activeSource, setActiveSource] = useState<'youtube' | 'spotify'>('youtube');
  const lastTrackIdRef = useRef<string | null>(null);
  const [showWinnerToast, setShowWinnerToast] = useState(false);

  const { playing, items, pending, loading, error, vote, userVotes, recentReward, refresh } = useQueue(room.id, userId);

  const reAddTrack = useCallback(async (item: typeof items[number]) => {
    await addToQueue({
      roomId: room.id,
      sourceId: item.sourceId,
      source: item.source,
      title: item.title,
      artist: item.artist,
      duration: item.duration,
      addedBy: userId,
    })
  }, [room.id, userId])

  // Winner Notification Logic
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-2xl animate-pulse text-neon-blue">
          Loading Room...
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

  const completed = items
    .filter(i => i.status === 'completed')
    .sort((a, b) => new Date(b.playingSince ?? b.addedAt).getTime() - new Date(a.playingSince ?? a.addedAt).getTime());
  const trackCount = pending.length + (playing ? 1 : 0);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">

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
              ROOM <span className="text-white">/</span> {room.name} <span className="text-zinc-500 text-lg">({room.code})</span>
            </h1>
          </div>
          <div className="px-4 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20 text-neon-blue font-mono text-sm">
            {trackCount} TRACKS
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Now Playing & Main Player */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/30 rounded-2xl p-1 border border-white/5 shadow-2xl">
              <NowPlaying 
                currentTrack={playing}
                queue={items}
                isHost={true} 
                userId={userId}
                onTrackChange={() => refresh()}
              />
            </div>

            {completed.length > 0 && (
              <section className="bg-zinc-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-zinc-400">
                  <span className="w-1.5 h-5 bg-zinc-600 rounded-full block" />
                  HISTORY
                </h2>
                <div className="space-y-2 opacity-70">
                  {completed.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">✓</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate text-sm">
                            {item.title}
                          </p>
                          <p className="text-zinc-400 text-xs truncate">
                            {item.artist}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => reAddTrack(item)}
                        className="ml-3 shrink-0 px-2 py-1 text-xs text-zinc-400 hover:text-neon-blue border border-white/10 hover:border-neon-blue/40 rounded transition"
                      >
                        + Re-add
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Queue & Leaderboard */}
          <div className="space-y-8">
            <section className="relative z-10 bg-zinc-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-neon-blue rounded-full block" />
                ADD TRACK
              </h2>
              {/* Source toggle */}
              <div className="flex gap-1 mb-4 p-1 bg-black/30 rounded-lg">
                <button
                  onClick={() => setActiveSource('youtube')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeSource === 'youtube'
                      ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  YouTube
                </button>
                <button
                  onClick={() => setActiveSource('spotify')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeSource === 'spotify'
                      ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Spotify
                </button>
              </div>
              {activeSource === 'youtube' ? (
                <YouTubeSearch roomId={room.id} userId={userId} />
              ) : (
                <SpotifySearch roomId={room.id} userId={userId} clientId={SPOTIFY_CLIENT_ID} />
              )}
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
                CONTRIBUTORS
              </h2>
              <Leaderboard roomId={room.id} />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RoomClient;
