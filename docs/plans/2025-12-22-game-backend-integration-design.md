# Game-Backend Integration Design

## Overview

Connect the game client to the backend to track runs and scores for logged-in users. Guests can play but scores are only saved for the session.

## Authentication

- Use `SessionProvider` from `next-auth/react` at app level
- `useSession()` hook to check auth state in components
- "Sign in with Google" button on home screen for unauthenticated users
- Show user display name and "Sign out" when logged in

## Game Flow

### Starting a Game (logged-in users)
1. User clicks Play → transitions to GetReadyScreen
2. Call `POST /api/game/start` to get `runToken`
3. Store token and record start timestamp
4. Proceed to PlayingScreen

### Starting a Game (guests)
1. User clicks Play → transitions to GetReadyScreen
2. Skip token fetch, proceed directly to PlayingScreen

### During Gameplay
- No changes to gameplay
- Track start time (already exists via `startTimeRef`)

### Game Over (logged-in users)
1. Calculate `durationMs = Date.now() - startTime`
2. Call `POST /api/runs/submit` with `{ runToken, score, durationMs }`
3. Display results: rank, best score, points earned, "New Best!" indicator

### Game Over (guests)
1. Display score locally
2. Update session best: `sessionBest = Math.max(sessionBest, score)`
3. Show "Sign in to save your progress" prompt

## Best Score Tracking

| User Type | Storage | Persistence | Source |
|-----------|---------|-------------|--------|
| Logged in | Database | All-time | Backend API response |
| Guest | React state | Session only | Client-side tracking |

## Files to Modify

### `src/app/layout.tsx`
- Wrap app with `SessionProvider`

### `src/app/page.tsx`
- Add session state management
- Track `runToken` and `startTime`
- Track `sessionBest` for guests, `userBest` for logged-in users
- Handle score submission in `onGameOver`

### `src/components/HomeScreen.tsx`
- Add "Sign in with Google" button (unauthenticated)
- Show user display name (authenticated)
- Display best score

### `src/components/PlayingScreen.tsx`
- Modify `onGameOver` callback to include `durationMs`
- Signature: `onGameOver: (score: number, durationMs: number) => void`

## New Files

### `src/hooks/useGameSession.ts`
Hook to encapsulate:
- Fetching run token before game
- Submitting score after game
- Error handling for API calls

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/game/start` | POST | Get run token before game |
| `/api/runs/submit` | POST | Submit score after game |
| `/api/users/me` | GET | Fetch user's best score on load |
