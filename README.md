# Chaos Music Player

Democratic, gamified collaborative music player for social gatherings, remote teams, and venues.

## Features

- **Democratic Queue**: Everyone votes on the next track
- **Winner Notifications**: Real-time toast notifications for winning tracks
- **Token Economy**: Skip, stop, or boost songs with earned tokens
- **Real-time Sync**: Live updates across all participants
- **Anonymous Join**: QR code or link-based instant access
- **Host Controls**: Admins manage room, mute/remove users, and force-skip tracks
- **Leaderboard**: Real-time session rankings by tokens spent and votes cast
- **YouTube Integration**: Access millions of songs instantly
- **Crowd Pleaser**: Earn +3 tokens when your queued song gets 3+ net votes
- **Spotify OAuth**: Connect Spotify account with PKCE flow for multi-source search

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with dark mode & neon accents
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Deployment**: Vercel
- **APIs**: YouTube Data API v3

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier supported)
- YouTube API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chaos-player.git
cd chaos-player
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Fill in your credentials in `.env.local`:
- Supabase URL and Anon Key (from https://supabase.com)
- YouTube API Key (from Google Cloud Console)

5. Run the development server:
```bash
npm run dev
```

6. Open http://localhost:3000 in your browser

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
├── lib/             # Utilities (Supabase client, helpers)
├── types/           # TypeScript type definitions
└── styles/          # Global styles (Tailwind)
```

## Database Schema

See `docs/database-schema.sql` for complete Supabase schema.

Key tables:
- `rooms` - Party/session containers
- `sessions` - User participation records
- `queue_items` - YouTube tracks in queue
- `votes` - Upvote/downvote tracking
- `tokens` - User token balance

## Development

### Running Tests

```bash
npm test
npm test:watch
```

**Test Coverage (Cycle #6):** 118 tests across 15 suites — schema validation, room management, queue operations, Queue UI, YouTube search, YouTube player, auto-advance, YouTube error handling, queue integration, NowPlaying, leaderboard, moderation, Leaderboard UI, ModerationPanel UI, Dynamic Room Page, and Winner Notifications.

### Building for Production

```bash
npm run build
npm run start
```

## Contributing

This project is in active development. See ROADMAP.md for upcoming features.

## License

MIT
