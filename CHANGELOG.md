# Changelog

## Cycle #11 - 2026-03-18

### Added
- `computeVoteDelta` pure function in `src/lib/queue.ts` for correct vote-flip delta computation
- `VoteButton` active prop with neon-blue/neon-pink highlight for current vote state
- YouTubeSearch: Escape key dismiss, outside-click dismiss via containerRef + mousedown listener, clear (×) button

### Fixed
- Votes table subscription 400 error (missing room_id column) — removed votes subscription; queue_items subscription is sufficient
- Optimistic vote update ignored prior vote direction — fixed with `computeVoteDelta` + `userVotes` ref

### Changed
- YouTubeSearch dropdown now uses `z-50` for correct layering over other UI elements

## Cycle #10 - 2026-03-18

### Added
- Playlist bootstrap logic: `promoteToPlaying` auto-promotes first pending item when no track is playing and queue is idle
- `hasBootstrapped` guard in `useQueue` hook prevents repeated bootstrap calls after initial startup

### Fixed
- Playlist never starting without manual host action when room first loads with queued tracks

### Changed
- `autoAdvance.ts` now exports `promoteToPlaying` for use in startup bootstrap flow
- `useQueue.ts` tracks bootstrap state to avoid redundant Supabase calls on re-renders

## Cycle #8 - 2026-03-18

### Added
- Crowd Pleaser token earn loop: award +3 tokens when queued song reaches net +3 votes (`src/lib/tokenEarn.ts`)
- `TokenEarnNotification` component with neon-green toast animation (`src/components/TokenEarnNotification.tsx`)
- Spotify OAuth PKCE flow with authorization code + PKCE verifier (`src/lib/spotify.ts`)
- Spotify search API integration returning `SourceSearchResult` type
- Source-agnostic `SourceSearchResult` type in `src/types/index.ts`
- 37 new tests: tokenEarn unit, TokenEarnNotification accessibility, Spotify OAuth/search unit tests

### Changed
- `YouTubeSearch` component now uses `next/image` `<Image />` instead of `<img>` for LCP optimization
- Schema updated with `tokens` ledger entries and `crowd_pleaser` earn type

## Cycle #7 - 2026-03-18

### Added
- GDPR Art. 17 Right to Erasure (`eraseUserData()` in `src/lib/gdpr.ts`)
- `GDPRSettings` component with two-step confirmation UI (idle → confirm → pending → done/error)
- `YouTubeSearch` component with real-time debounced search, add feedback, and dark neon theme
- `getSupabase()` factory export in `src/lib/supabase.ts`
- `useDebounce` hook (`src/hooks/useDebounce.ts`)
- 22 new tests across GDPR unit, YouTube search, and RoomPage integration suites

### Fixed
- `addToQueue` called with `userId` instead of `addedBy` in YouTubeSearch
- `Queue` component receiving wrong props (`roomId`/`userId` instead of `items`/`loading`/`error`/`vote`)
- Unused `addToQueue` import in `useQueue.ts` causing type error
- `eraseUserData` not catching rejected promises (network failures)
- RoomPage test missing mocks for `getRoomByCode`, `useRouter`, and `YouTubeSearch`
- GDPR integration test running without `INTEGRATION` flag (now `describe.skip` by default)

### Changed
- `useQueue` no longer imports unused `addToQueue` from queue lib
- RoomPage now passes correct props to `<Queue>` (items, loading, error, vote)
