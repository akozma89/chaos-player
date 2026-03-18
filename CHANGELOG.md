# Changelog

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
