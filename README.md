# Chaos Music Player

Democratic, gamified collaborative music player for social gatherings, remote teams, and venues.

## Features

- **Democratic Queue**: Everyone votes on the next track
- **Token Economy**: Skip, stop, or boost songs with earned tokens
- **Real-time Sync**: Live updates across all participants
- **Anonymous Join**: QR code or link-based instant access
- **Host Controls**: Admins manage room and moderate if needed
- **YouTube Integration**: Access millions of songs instantly

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

**Test Coverage (Cycle #3):** 76 tests across 10 suites — schema validation, room management, queue operations, Queue UI, YouTube search, YouTube player, auto-advance, YouTube error handling, queue integration, and NowPlaying.

### Building for Production

```bash
npm run build
npm run start
```

## Contributing

This project is in active development. See ROADMAP.md for upcoming features.

## License

MIT
