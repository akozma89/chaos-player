'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueue } from '../../../hooks/useQueue';
import { addToQueue } from '../../../lib/queue';
import { getRoomPassword } from '../../../lib/rooms';
import { Queue } from '../../../components/Queue';
import Leaderboard from '../../../components/Leaderboard';
import { UnifiedPlayer } from '../../../components/UnifiedPlayer';
import { WinnerToast } from '../../../components/WinnerToast';
import YouTubeSearch from '../../../components/YouTubeSearch';
import SpotifySearch from '../../../components/SpotifySearch';
import { TokenEarnNotification } from '../../../components/TokenEarnNotification';
import ChaosSyncOverlay from '../../../components/ChaosSyncOverlay';
import { TrackAddedToast } from '../../../components/TrackAddedToast';

const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? ''

import { Room } from '../../../types';

interface RoomClientProps {
  room: Room & { code: string };
  userId: string;
}

const RoomClient = ({ room: initialRoom, userId }: RoomClientProps) => {
  const router = useRouter();
  const [activeSource, setActiveSource] = useState<'youtube' | 'spotify'>('youtube');
  const lastTrackIdRef = useRef<string | null>(null);
  const [showWinnerToast, setShowWinnerToast] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const [readdingIds, setReaddingIds] = useState<Set<string>>(new Set());
  type ActiveToast = { id: string, trackId: string };
  const [activeToasts, setActiveToasts] = useState<ActiveToast[]>([]);
  const prevPendingRef = useRef<typeof pending>([]);
  const isInitializedRef = useRef(false);

  const { 
    playing, 
    items, 
    pending, 
    loading, 
    error, 
    vote, 
    userVotes, 
    session, 
    room: liveRoom, 
    recentReward, 
    isSyncing, 
    refresh 
  } = useQueue(initialRoom.id, userId);

  const room = liveRoom || initialRoom;
  const isHost = room.hostId === userId;

  const handleCopyLink = useCallback(async () => {
    setIsCopying(true);
    try {
      let url = `${window.location.origin}/room/${initialRoom.code}/join`;
      
      // If host and private, try to get password to include in link
      if (isHost && !room.isPublic) {
        const { password } = await getRoomPassword(room.id);
        if (password) {
          url += `?pw=${encodeURIComponent(password)}`;
        }
      }
      
      await navigator.clipboard.writeText(url);
      setTimeout(() => setIsCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setIsCopying(false);
    }
  }, [initialRoom.code, room.id, room.isPublic, isHost]);

  const reAddTrack = useCallback(async (item: typeof items[number]) => {
    setReaddingIds(prev => new Set(prev).add(item.id));
    await addToQueue({
      roomId: room.id,
      sourceId: item.sourceId,
      source: item.source,
      title: item.title,
      artist: item.artist,
      duration: item.duration,
      addedBy: userId,
      addedByName: session?.username,
      thumbnailUrl: item.thumbnailUrl
    })
    setTimeout(() => {
      setReaddingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 2000);
  }, [room.id, userId, session?.username])

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

  // Track Added Notification Logic
  useEffect(() => {
    if (loading) return;

    if (!isInitializedRef.current) {
      prevPendingRef.current = pending;
      isInitializedRef.current = true;
      return;
    }

    const prevIds = new Set(prevPendingRef.current.map(i => i.id));
    const newItems = pending.filter(i => !prevIds.has(i.id));

    if (newItems.length > 0) {
      const newToasts = newItems.map(item => ({
        id: crypto.randomUUID(),
        trackId: item.id
      }));

      setActiveToasts(prev => [...prev, ...newToasts]);
      
      newToasts.forEach(t => {
        setTimeout(() => {
          setActiveToasts(prev => prev.filter(x => x.id !== t.id));
        }, 5000);
      });
    }
    
    prevPendingRef.current = pending;
  }, [pending, loading]);

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

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      
      <ChaosSyncOverlay isSyncing={isSyncing} />

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
      
      <div className="fixed top-28 right-8 z-[60] flex flex-col gap-3 pointer-events-none">
        {activeToasts.map(toast => {
          const addedTrack = items.find((i) => i.id === toast.trackId);
          if (!addedTrack) return null;
          return (
            <div key={toast.id} className="pointer-events-auto">
              <TrackAddedToast 
                track={addedTrack} 
                userVote={userVotes[addedTrack.id]}
                onVote={(type) => vote(addedTrack.id, type)}
                onDismiss={() => setActiveToasts(prev => prev.filter(x => x.id !== toast.id))} 
              />
            </div>
          )
        })}
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center group">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.push('/')}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-white hover:bg-white/10 transition-all active:scale-95"
              title="Back to Lobby"
            >
              ←
            </button>
            <div className="space-y-0.5">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-white tracking-tighter uppercase">
                  {room.name}
                </h1>
                <span className="px-2 py-0.5 rounded bg-neon-pink/10 border border-neon-pink/20 text-[10px] font-bold text-neon-pink uppercase tracking-widest">
                  {initialRoom.code}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em]">
                {room.isPublic ? 'Public Session' : 'Private Session'}
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all active:scale-95 ${
              isCopying 
                ? 'bg-neon-green/20 border-neon-green text-neon-green' 
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-widest">
              {isCopying ? 'Copied!' : 'Copy Invite'}
            </span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          </button>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Player – first on all screen sizes */}
          <div className="lg:col-span-2 order-1 lg:order-none">
            <UnifiedPlayer
              currentTrack={playing}
              queue={items}
              room={room}
              isHost={isHost}
              userId={userId}
              isSyncing={isSyncing}
              onTrackChange={() => refresh()}
            />
          </div>

          {/* Right Column: Add Track, Up Next, Contributors
              On mobile: order-2 so it follows the player directly.
              On desktop: natural grid flow places it in the third column. */}
          <div className="space-y-8 order-2 lg:order-none lg:row-span-2">
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
                <YouTubeSearch roomId={room.id} userId={userId} username={session?.username} />
              ) : (
                <SpotifySearch roomId={room.id} userId={userId} clientId={SPOTIFY_CLIENT_ID} username={session?.username} />
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

          {/* History – on mobile this appears after Add Track + Up Next (order-3).
              On desktop it sits below the player in column 1-2. */}
          {completed.length > 0 && (
            <section className="lg:col-span-2 order-3 lg:order-none bg-zinc-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
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
                        <div className="flex items-center gap-2">
                          <p className="text-zinc-400 text-xs truncate">
                            {item.artist}
                          </p>
                          <span className="text-zinc-600 text-[10px]">•</span>
                          <span className="text-zinc-500 text-[10px] uppercase font-bold">
                            {item.addedByName || 'Chaos'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const isReadded = pending.some(p => p.sourceId === item.sourceId);
                      const isJustClicked = readdingIds.has(item.id);
                      const isDisabled = isReadded || isJustClicked;
                      return (
                        <button
                          onClick={() => isDisabled ? null : reAddTrack(item)}
                          disabled={isDisabled}
                          className={`ml-3 shrink-0 px-2 py-1 text-xs border rounded transition ${
                            isDisabled
                              ? 'text-zinc-600 bg-white/5 border-white/5 cursor-not-allowed'
                              : 'text-zinc-400 hover:text-neon-blue border-white/10 hover:border-neon-blue/40'
                          }`}
                        >
                          {isReadded ? '✓ Added' : isJustClicked ? 'Adding...' : '+ Re-add'}
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default RoomClient;
