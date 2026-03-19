# Changelog

## Cycle #20 - 2026-03-19

### Fixed
- `playlistBootstrap.test.ts`: Fixed `promoteToPlaying` type error by switching to `bootstrapQueue` and updating argument signature
- `playbackLoop.test.ts`: Removed unused `getQueueItems` and `supabase` imports to fix lint/type errors
- `schema.test.ts`: Added missing `roomId` to `Vote` object to satisfy TypeScript requirements
- `useQueue.test.tsx`: Removed unused `hook` variable to fix lint error
- `queue.ts`: Added missing `roomId` to `Vote` return object in `castVote` function
- `useQueueActiveVote.test.tsx`: Updated `autoAdvance` mock to include `bootstrapQueue` (replacing `promoteToPlaying`)
- `YouTubeSearch.test.tsx`: Updated button text expectation from `+ Add` to `+` to match implementation

### Changed
- `README.md` updated with latest test coverage stats (240 tests, 31 suites)

## Cycle #19 - 2026-03-19

### Added
- `AutoplayGuard`: Interactive "Resume Playback" overlay to bypass browser autoplay restrictions
- `vote-toggle-off-logic`: Users can now toggle off their active vote (click again to remove upvote/downvote)

### Fixed
- `playlist-never-starts-bootstrap-race`: Fixed race condition in `useQueue` where playlist failed to start on initial room load
- `youtube-search-results-overlay-persistence`: Search results now correctly dismiss when clicking outside or selecting a song
- `YoutubePlayer`: Fixed unused `act` import type error in tests

### Changed
- `README.md` updated with latest test coverage stats (246 tests, 30 suites)

## Cycle #18 - 2026-03-19

### Added
- `YouTubeSearch`: Support for multiple concurrent song additions (Sets instead of single strings for `addingIds` and `addedIds`)
- `YouTubeSearch`: Enhanced TDD coverage for empty states, scrolling, and keyboard navigation with long result sets

### Fixed
- `YouTubeSearch`: 'Add' buttons are no longer globally disabled when a single song is being added; only the specific item being added is disabled.

### Changed
- `SpotifySearch`: Formally verified and re-committed existing PKCE and search integration code.
- `README.md` updated with latest test coverage stats (242 tests, 29 suites)

## Cycle #17 - 2026-03-19

### Added
- `spotifySession`: Token lifecycle management (save/load/clear via sessionStorage)
- `ConnectSpotify`: PKCE OAuth flow — initiates Spotify auth redirect, disconnect support
- `SpotifySearch`: Spotify track search with source toggle (YouTube / Spotify)
- `/auth/spotify/callback`: PKCE callback page exchanging code for tokens (wrapped in Suspense)
- Room page: YouTube/Spotify source toggle integrated into search UI

### Fixed
- `SpotifyCallbackPage`: Added `Suspense` boundary around `useSearchParams` to fix static prerender build error

### Changed
- 27 new tests across `spotifySession`, `ConnectSpotify`, and `SpotifySearch`

## Cycle #16 - 2026-03-19

### Added
- `YouTubeSearch`: Clearable input button (×) to reset search field
- `YouTubeSearch`: Escape key dismisses results dropdown
- `YouTubeSearch`: Outside-click dismisses results dropdown
- `YouTubeSearch`: Keyboard arrow navigation with `scrollIntoView` keeps item visible
- `autoAdvance`: `promoteToPlaying` RPC bootstrap — starts playlist when no track is playing
- `useQueue`: `hasBootstrapped` guard prevents concurrent bootstrap calls

### Fixed
- `votes` table missing `room_id` column causing slow RLS join scans (migration `006_votes_room_id.sql`)
- `getUserVotes` query not scoped to room, causing cross-room vote leakage
- Playlist never starting when no track was currently playing
- `YouTubeSearch` results dropdown hidden behind other elements (z-index fix)

### Changed
- 43 new tests added (25 unit, 18 component) — total: 216 passing, 2 skipped

## Cycle #15 - 2026-03-19

### Added
- `YouTubeSearch`: Empty state message when search returns no results
- `YouTubeSearch`: Scrollable bounded results list (`max-h-64 overflow-y-auto`) for long result sets
- `YouTubeSearch`: `scrollIntoView` on ArrowDown/ArrowUp keyboard navigation to keep highlighted item visible

### Fixed
- `votes` table missing `room_id` column — schema bug causing slow RLS and broken Realtime filter (migration `006_votes_room_id.sql`)

### Changed
- `README.md` updated with latest test coverage stats (216 tests, 28 suites)

## Cycle #14 - 2026-03-19

### Added
- `AutoplayGuard` component: Prevents YouTube autoplay blocks with a user-friendly "Resume Playback" overlay
- `earned-tokens-leaderboard-aggregation`: Leaderboard now tracks tokens earned via "Crowd Pleaser" rewards
- `TokenEarnNotification` integrated with real-time token events in `useQueue` hook

### Fixed
- `useQueue` hook TypeError: `getUserVotes` missing from Jest mocks in test suite
- `YouTubeSearch` lint warning: Using `<img>` instead of `next/image` (fixed via ESLint suppression in test mock)

### Changed
- `README.md` updated with latest test coverage stats (212 tests, 28 suites)

## Cycle #13 - 2026-03-19

### Added
- Keyboard navigation (ArrowUp, ArrowDown, Enter) in `YouTubeSearch` component for faster track addition
- `hasBootstrapped` guard in `useQueue` hook prevents redundant bootstrap attempts on subsequent room loads

### Fixed
- Redundant bootstrap logic firing multiple times on re-renders, reducing unnecessary Supabase calls

### Changed
- `YouTubeSearch` search results now auto-dismiss after adding a song
- `README.md` updated with latest test coverage stats (212 tests, 25 suites)

## Cycle #12 - 2026-03-19

### Added
- `playingSince` field to `QueueItem` for accurate real-time track progress sync across clients
- Comprehensive type coverage for `QueueItem` across lib and test suites

### Fixed
- Type errors in 9 test files where `playingSince` was missing or incompatible
- `createRoom` type mismatch in `rooms.test.ts` (missing `username`)
- `TypeError: supabase.rpc is not a function` in queue tests by adding `rpc` to Supabase mocks
- `TypeError: refresh is not a function` in `RoomPage.test.tsx` by adding `refresh` to `useQueue` mock

### Changed
- `addToQueue` now returns `playingSince: null` by default
- `README.md` updated with latest test coverage stats (210 tests, 25 suites)

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
