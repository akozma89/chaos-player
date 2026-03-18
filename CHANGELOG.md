# Changelog

## Cycle #3 - 2026-03-18

### Added
- YouTube error boundary with `YouTubeErrorToast` component (`src/components/YouTubeErrorToast.tsx`)
- Optimistic rollback for failed queue operations (`src/lib/youtube.ts`)
- 7 integration tests for queue + YouTube error flows (`src/__tests__/queueIntegration.test.ts`)
- 13 unit tests for YouTube error handling and `NowPlaying` component
- Total test coverage: 76 tests across 10 suites

### Changed
- `NowPlaying` component hardened with error state display
- `youtube.ts` enhanced with resilient error classification and retry logic

## Cycle #2 - 2026-03-18

### Added
- YouTube search utility with YouTube Data API v3 (`src/lib/youtube.ts`)
- YouTube IFrame API loader with lifecycle management (`src/lib/youtubeIframe.ts`)
- `YoutubePlayer` React component with state-change handling (`src/components/YoutubePlayer.tsx`)
- `NowPlaying` component showing current track with controls (`src/components/NowPlaying.tsx`)
- Auto-advance logic: advances queue when track ends (`src/lib/autoAdvance.ts`)
- 21 unit tests for YouTube integration (search, player, auto-advance)

### Fixed
- `InstanceType` instead of `ReturnType` for `window.YT.Player` constructor type

## Cycle #1 - 2026-03-18

### Added
- Schema validation utilities (`src/lib/schema.ts`)
- Supabase RLS migration (`supabase/migrations/001_initial_schema.sql`)
- Anonymous auth via Supabase (`src/lib/auth.ts`)
- Room creation with 6-char code (`src/lib/rooms.ts`)
- Token airdrop on join
- Queue ordering by net votes + FIFO (`src/lib/queue.ts`)
- Vote upsert with optimistic UI (`src/hooks/useQueue.ts`)
- Skip track with token spend
- Real-time queue subscription (Supabase Realtime)
- `CreateRoomForm` component
- `JoinRoomForm` component
- `VoteButton` component
- `Queue` component
- Home page with room creation/join flow (`src/app/page.tsx`)
- 35 unit tests across schema, rooms, queue, and Queue UI

### Fixed
- Supabase client uses placeholder credentials at build time (no throw on missing env)
- TypeScript strict-mode compliance across all source files
