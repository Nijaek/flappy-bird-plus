# Flappy Bird Plus

A modern, feature-rich Flappy Bird clone built with Next.js, featuring pixel-perfect canvas rendering, user accounts, global leaderboards, and a cosmetic shop.

## Features

- **Classic Gameplay** - Tap or press space to flap through pipes
- **Pixel Art Graphics** - Canvas-based rendering with animated backgrounds, parallax scrolling, and smooth 60fps gameplay
- **User Accounts** - Sign in with Google or play as a guest
- **Global Leaderboard** - Compete for the highest score worldwide
- **Points System** - Earn points from gameplay to spend in the shop
- **Cosmetic Shop** - Unlock bird skins and trail effects
- **Sound Effects** - Retro-style audio for flapping, scoring, and collisions
- **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Frontend**: React 19, TypeScript, Tailwind CSS 4
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis (ioredis)
- **Authentication**: NextAuth.js v5 (Google OAuth + credentials)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance (optional, for caching)

### Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="your-auth-secret"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
REDIS_URL="redis://..."
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Seed shop items
npm run seed:items

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HTTPS |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed:items` | Seed shop items to database |
| `npm run sync-leaderboard` | Sync leaderboard cache |
| `npm run cleanup-tokens` | Clean up expired game tokens |

## Project Structure

```
src/
├── app/              # Next.js App Router pages & API routes
│   ├── api/          # Backend API endpoints
│   │   ├── auth/     # Authentication routes
│   │   ├── game/     # Game session management
│   │   ├── leaderboard/  # Leaderboard queries
│   │   ├── runs/     # Score submission
│   │   └── shop/     # Shop & purchases
│   └── page.tsx      # Main game page
├── components/       # React components
├── contexts/         # React contexts (audio)
├── game/             # Game engine (renderer, constants, trails)
├── hooks/            # Custom React hooks
├── lib/              # Utilities (Prisma, Redis, auth config)
└── types/            # TypeScript type definitions
```

## License

MIT
