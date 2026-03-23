'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueue } from '../../../hooks/useQueue';
import { addToQueue, toggleSkipVote } from '../../../lib/queue';
import { getRoomPassword } from '../../../lib/rooms';
import { Queue } from '../../../components/Queue';
import Leaderboard from '../../../components/Leaderboard';
import { UnifiedPlayer } from '../../../components/UnifiedPlayer';
import { WinnerToast } from '../../../components/WinnerToast';
import { TokenEarnNotification } from '../../../components/TokenEarnNotification';
import ChaosSyncOverlay from '../../../components/ChaosSyncOverlay';
import SkipVetoOverlay from '../../../components/SkipVetoOverlay';
import { TrackAddedToast } from '../../../components/TrackAddedToast';
import { SearchModal } from '../../../components/SearchModal';
import { vetoHostSkip } from '../../../lib/moderation';

const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? ''

import Image from 'next/image';
import { Room } from '../../../types';

interface RoomClientProps {
  room: Room & { code: string };
  userId: string;
}

const RoomClient = ({ room: initialRoom, userId }: RoomClientProps) => {
  const router = useRouter();
  const lastTrackIdRef = useRef<string | null>(null);
  const [showWinnerToast, setShowWinnerToast] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

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
    skipVotes,
    activeSessionCount,
    activeSkipRequest,
    userVetoVotes,
    refresh 
  } = useQueue(initialRoom.id, userId);

  const room = liveRoom || initialRoom;
  const isHost = room.hostId === userId;

  const handleVeto = useCallback(async () => {
    if (!activeSkipRequest) return;
    const { error: vetoError } = await vetoHostSkip({
      requestId: activeSkipRequest.id,
      userId
    });
    if (vetoError) {
      console.error('Veto failed:', vetoError);
    } else {
      refresh();
    }
  }, [activeSkipRequest, userId, refresh]);

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
    .filter(i => i.status === 'completed' || i.status === 'skipped')
    .sort((a, b) => new Date(b.playingSince ?? b.addedAt).getTime() - new Date(a.playingSince ?? a.addedAt).getTime());

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      
      <ChaosSyncOverlay isSyncing={isSyncing} />

      {activeSkipRequest && (
        <SkipVetoOverlay
          requestId={activeSkipRequest.id}
          expiresAt={activeSkipRequest.expiresAt}
          vetoCount={activeSkipRequest.vetoCount}
          vetoThreshold={activeSkipRequest.vetoThreshold}
          activeSessionCount={activeSessionCount}
          onVeto={handleVeto}
          isVetoedByUser={userVetoVotes.includes(userId)}
          isHost={isHost}
        />
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
      
      <div className="fixed top-4 left-4 right-4 sm:top-28 sm:left-auto sm:right-8 sm:w-80 z-[60] flex flex-col gap-3 pointer-events-none">
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
        <header className="flex justify-between items-start sm:items-center gap-3 sm:gap-6 group">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0 flex-1">
            <button
              onClick={() => router.push('/')}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-white hover:bg-white/10 transition-all active:scale-95 flex-shrink-0"
              title="Back to Lobby"
            >
              ←
            </button>
            <div className="space-y-1 min-w-0">
              {/* Room name - visible on all sizes */}
              <h1 className="text-base sm:text-2xl font-black text-white tracking-tighter uppercase truncate">
                {room.name}
              </h1>
              {/* Code + Visibility - same row on all sizes */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-bold text-neon-pink bg-neon-pink/10 border border-neon-pink/20 uppercase tracking-widest flex-shrink-0">
                  {initialRoom.code}
                </span>
                <span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded-full uppercase tracking-widest flex-shrink-0">
                  {room.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all active:scale-95 flex-shrink-0 bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10`}
              title="Search and add tracks"
            >
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                Search track
              </span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all active:scale-95 flex-shrink-0 ${
                isCopying
                  ? 'bg-neon-green/20 border-neon-green text-neon-green'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
              title={isCopying ? 'Copied!' : 'Copy Invite'}
            >
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                {isCopying ? 'Copied!' : 'Copy Invite'}
              </span>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Player – first on all screen sizes; sticky on mobile so it stays visible while scrolling */}
          <div className="lg:col-span-2 z-[100] order-1 lg:order-none sticky top-2 self-start lg:static lg:z-auto">
            <UnifiedPlayer
              currentTrack={playing}
              queue={items}
              room={room}
              isHost={isHost}
              userId={userId}
              isSyncing={isSyncing}
              skipVotes={skipVotes}
              activeSessionCount={activeSessionCount}
              onVoteSkip={(trackId) => toggleSkipVote(trackId, userId, room.id)}
              onTrackChange={() => refresh()}
            />
          </div>

          {/* Right Column: Up Next, Contributors
              On mobile: order-2 so it follows the player directly.
              On desktop: natural grid flow places it in the third column. */}
          <div className="space-y-8 order-2 lg:order-none lg:row-span-2">
            <section className="bg-zinc-900/50 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-neon-green rounded-full block" />
                  UP NEXT
                </h2>
                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-full transition-colors"
                  title="Add track"
                >
                  + Add
                </button>
              </div>
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

          {/* History – on mobile this appears after Up Next (order-3).
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
                      <div className="relative w-8 h-8 flex-shrink-0">
                        {item.thumbnailUrl ? (
                          <Image
                            src={item.thumbnailUrl}
                            alt=""
                            fill
                            sizes="32px"
                            className="rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-black/40" />
                        )}
                        <div className={`absolute inset-0 rounded-lg flex items-center justify-center ${
                          item.status === 'skipped'
                            ? 'bg-neon-pink/50'
                            : 'bg-black/50'
                        }`}>
                          <span className="text-sm">{item.status === 'skipped' ? '✕' : '✓'}</span>
                        </div>
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
                          {item.status === 'skipped' && (
                            <>
                              <span className="text-zinc-600 text-[10px]">•</span>
                              <span className="text-neon-pink text-[10px] uppercase font-bold tracking-widest">Skipped</span>
                            </>
                          )}
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

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => setIsSearchModalOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-neon-green text-black shadow-lg hover:shadow-xl hover:scale-110 transition-all active:scale-95 flex items-center justify-center font-bold text-2xl"
        title="Add track"
      >
        +
      </button>

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        roomId={room.id}
        userId={userId}
        username={session?.username}
        clientId={SPOTIFY_CLIENT_ID}
        allowedResources={room.allowedResources}
      />
    </div>
  );
};

export default RoomClient;
