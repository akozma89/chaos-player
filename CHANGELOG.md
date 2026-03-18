# Changelog

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
