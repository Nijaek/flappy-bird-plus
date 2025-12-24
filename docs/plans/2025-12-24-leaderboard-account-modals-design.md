# Leaderboard & Account Modals Design

## Overview

Two new modal features for the home screen:
1. **Leaderboard Modal** - View top scores, search users, pagination
2. **Account Modal** - View user stats and sign out

## Architecture

Both modals use a hybrid approach:
- Canvas-drawn panel background (consistent pixel-art style)
- HTML overlay for interactive content (inputs, buttons, scrolling)

### New Components

- `src/components/LeaderboardModal.tsx`
- `src/components/AccountModal.tsx`

### State Management (page.tsx)

```typescript
const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
const [showAccountModal, setShowAccountModal] = useState(false);
```

## Leaderboard Modal

### Layout

```
┌─────────────────────────────────┐
│  LEADERBOARD            [X]     │
├─────────────────────────────────┤
│  🔍 [Search username...]        │
├─────────────────────────────────┤
│  YOUR RANK                      │
│  #42  nijae           1,234     │
├─────────────────────────────────┤
│  #1   speedrunner     9,999     │
│  #2   flappyking      8,432     │
│  #3   birdmaster      7,891     │
│  ...                            │
├─────────────────────────────────┤
│  [Load More]                    │
└─────────────────────────────────┘
```

### Features

- **Your Rank** section always visible at top (for authenticated users)
- **Search** with 300ms throttle, server-side query
- **Load More** pagination (20 entries per page)
- **Scrollable** entry list

### Component State

```typescript
entries: LeaderboardEntry[]
searchQuery: string
isLoading: boolean
hasMore: boolean
userRank: { rank: number, bestScore: number } | null
```

### API Integration

- `GET /api/leaderboard?offset=0&limit=20` - Initial load & pagination
- `GET /api/leaderboard?search=<query>` - Username search (new)
- `GET /api/leaderboard/me` - Current user's rank

## Account Modal

### Layout

```
┌─────────────────────────────────┐
│  ACCOUNT                [X]     │
├─────────────────────────────────┤
│                                 │
│         👤 nijae               │
│                                 │
├─────────────────────────────────┤
│  BEST SCORE         1,234      │
│  GAMES PLAYED         47       │
│  TOTAL POINTS      12,850      │
├─────────────────────────────────┤
│                                 │
│        [Sign Out]               │
│                                 │
└─────────────────────────────────┘
```

### Features

- Display username prominently
- Show stats: best score, games played, total points
- Sign out button

### Data Source

Extend `GET /api/users/me` to include `gamesPlayed` count.

## API Changes

### New: Search Leaderboard

Add search parameter to `GET /api/leaderboard`:

```typescript
// When search param present:
// 1. Find users where displayName ILIKE '%query%'
// 2. Get their scores from Redis
// 3. Return sorted by score descending
```

### Update: User Profile

Add `gamesPlayed` to `GET /api/users/me` response:

```typescript
{
  user: {
    id, displayName, email, pointsBalance,
    bestScore: { bestScore, achievedAt },
    gamesPlayed: number  // Count of Run records
  }
}
```

## HomeScreen Changes

### Props Update

```typescript
interface HomeScreenProps {
  onStart: () => void;
  isAuthenticated: boolean;
  userDisplayName: string | null;
  bestScore: number;
  onAccountClick: () => void;
  onLeaderboardClick: () => void;  // NEW
}
```

### Button Handlers

Leaderboard button calls `onLeaderboardClick()`.

Account button always calls `onAccountClick()` - parent decides behavior based on auth state.

## Page.tsx Wiring

```typescript
const handleLeaderboardClick = () => setShowLeaderboardModal(true);

const handleAccountClick = () => {
  if (isAuthenticated) {
    setShowAccountModal(true);
  } else {
    setShowAuthModal(true);
  }
};
```

Render modals conditionally:

```tsx
{showLeaderboardModal && <LeaderboardModal onClose={() => setShowLeaderboardModal(false)} />}
{showAccountModal && <AccountModal onClose={() => setShowAccountModal(false)} />}
```
