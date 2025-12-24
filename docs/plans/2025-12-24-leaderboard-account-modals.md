# Leaderboard & Account Modals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add functional leaderboard modal (with search, pagination, user rank) and account modal (with stats and sign out) to the home screen.

**Architecture:** Two new modal components using HTML/CSS overlay pattern (like AuthModal). HomeScreen passes callbacks to page.tsx which manages modal visibility state. API extended for search and games played count.

**Tech Stack:** Next.js, React, TypeScript, Prisma, Redis, next-auth

---

## Task 1: Add gamesPlayed to /api/users/me

**Files:**
- Modify: `src/app/api/users/me/route.ts`

**Step 1: Update the GET handler to include gamesPlayed count**

In `src/app/api/users/me/route.ts`, add a count query for runs:

```typescript
// After line 34 (after the user query), add:
const gamesPlayed = await prisma.run.count({
  where: { userId: session.user.id },
});

// Update the return (line 43) to include gamesPlayed:
return NextResponse.json({ user: { ...user, gamesPlayed } });
```

**Step 2: Test manually**

Run: `npm run dev`
Visit: `https://localhost:3000/api/users/me` (while logged in)
Expected: Response includes `gamesPlayed` field with a number

**Step 3: Commit**

```bash
git add src/app/api/users/me/route.ts
git commit -m "feat(api): add gamesPlayed count to /users/me endpoint"
```

---

## Task 2: Add search parameter to /api/leaderboard

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`

**Step 1: Add search handling to GET handler**

After line 9 (limit parsing), add search parameter handling:

```typescript
const search = searchParams.get('search')?.trim().toLowerCase();

// If search is provided, query differently
if (search && search.length >= 2) {
  // Find users matching the search
  const matchingUsers = await prisma.user.findMany({
    where: {
      displayName: {
        contains: search,
        mode: 'insensitive',
      },
    },
    select: { id: true, displayName: true },
    take: 50,
  });

  if (matchingUsers.length === 0) {
    return NextResponse.json({
      leaderboard: [],
      total: 0,
      offset: 0,
      limit,
    });
  }

  // Get scores for matching users from Redis
  const userScores = await Promise.all(
    matchingUsers.map(async (user) => {
      const score = await redis.zscore(LEADERBOARD_KEY, user.id);
      const rank = await redis.zrevrank(LEADERBOARD_KEY, user.id);
      return {
        userId: user.id,
        displayName: user.displayName,
        score: score ? parseInt(score) : null,
        rank: rank !== null ? rank + 1 : null,
      };
    })
  );

  // Filter out users with no score and sort by score descending
  const leaderboard = userScores
    .filter((u) => u.score !== null)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((u) => ({
      rank: u.rank,
      displayName: u.displayName || 'Unknown',
      bestScore: u.score,
    }));

  return NextResponse.json({
    leaderboard,
    total: leaderboard.length,
    offset: 0,
    limit,
  });
}
```

**Step 2: Test manually**

Run: `npm run dev`
Visit: `https://localhost:3000/api/leaderboard?search=nij`
Expected: Returns users whose displayName contains "nij"

**Step 3: Commit**

```bash
git add src/app/api/leaderboard/route.ts
git commit -m "feat(api): add search parameter to leaderboard endpoint"
```

---

## Task 3: Create AccountModal component

**Files:**
- Create: `src/components/AccountModal.tsx`
- Create: `src/components/AccountModal.css`

**Step 1: Create the CSS file**

Create `src/components/AccountModal.css`:

```css
/* Account Modal - Matches Auth Modal Style */

.account-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.account-modal {
  background: #DEB858;
  border: 4px solid #8B6914;
  padding: 24px;
  max-width: 320px;
  width: 90%;
  box-shadow:
    4px 4px 0 #543810,
    -2px -2px 0 #F8E8A8 inset;
  position: relative;
}

.account-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: #8B6914;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.account-close:hover {
  color: #D85020;
}

.account-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 14px;
  color: #FFFFFF;
  text-align: center;
  margin-bottom: 20px;
  text-shadow:
    2px 2px 0 #543810,
    -1px -1px 0 #543810,
    1px -1px 0 #543810,
    -1px 1px 0 #543810;
}

.account-username {
  font-family: 'Press Start 2P', monospace;
  font-size: 16px;
  color: #FFFFFF;
  text-align: center;
  margin-bottom: 24px;
  text-shadow:
    2px 2px 0 #543810,
    -1px -1px 0 #543810;
}

.account-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.account-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(248, 240, 216, 0.5);
  border: 2px solid #8B6914;
}

.account-stat-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #543810;
}

.account-stat-value {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #543810;
}

.account-signout-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  width: 100%;
  padding: 12px 16px;
  border: 3px solid #8B6914;
  background: #F8F0D8;
  color: #543810;
  cursor: pointer;
  transition: transform 0.1s;
}

.account-signout-btn:hover {
  background: #FFF8E8;
}

.account-signout-btn:active {
  transform: translateY(2px);
}

.account-loading {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #543810;
  text-align: center;
  padding: 40px;
}
```

**Step 2: Create the component file**

Create `src/components/AccountModal.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import './AccountModal.css';

interface AccountModalProps {
  onClose: () => void;
}

interface UserData {
  displayName: string | null;
  pointsBalance: number;
  bestScore: { bestScore: number } | null;
  gamesPlayed: number;
}

export default function AccountModal({ onClose }: AccountModalProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/users/me');
        if (res.ok) {
          const data = await res.json();
          setUserData(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    onClose();
  };

  if (isLoading) {
    return (
      <div className="account-overlay">
        <div className="account-modal">
          <div className="account-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-overlay">
      <div className="account-modal">
        <button className="account-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h1 className="account-title">ACCOUNT</h1>

        <div className="account-username">
          {userData?.displayName || 'Unknown'}
        </div>

        <div className="account-stats">
          <div className="account-stat-row">
            <span className="account-stat-label">BEST SCORE</span>
            <span className="account-stat-value">
              {userData?.bestScore?.bestScore ?? 0}
            </span>
          </div>
          <div className="account-stat-row">
            <span className="account-stat-label">GAMES PLAYED</span>
            <span className="account-stat-value">
              {userData?.gamesPlayed ?? 0}
            </span>
          </div>
          <div className="account-stat-row">
            <span className="account-stat-label">TOTAL POINTS</span>
            <span className="account-stat-value">
              {userData?.pointsBalance ?? 0}
            </span>
          </div>
        </div>

        <button className="account-signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/AccountModal.tsx src/components/AccountModal.css
git commit -m "feat: add AccountModal component with user stats"
```

---

## Task 4: Create LeaderboardModal component

**Files:**
- Create: `src/components/LeaderboardModal.tsx`
- Create: `src/components/LeaderboardModal.css`

**Step 1: Create the CSS file**

Create `src/components/LeaderboardModal.css`:

```css
/* Leaderboard Modal - Matches Auth Modal Style */

.leaderboard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.leaderboard-modal {
  background: #DEB858;
  border: 4px solid #8B6914;
  padding: 24px;
  max-width: 360px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    4px 4px 0 #543810,
    -2px -2px 0 #F8E8A8 inset;
  position: relative;
}

.leaderboard-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: #8B6914;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.leaderboard-close:hover {
  color: #D85020;
}

.leaderboard-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 14px;
  color: #FFFFFF;
  text-align: center;
  margin-bottom: 16px;
  text-shadow:
    2px 2px 0 #543810,
    -1px -1px 0 #543810,
    1px -1px 0 #543810,
    -1px 1px 0 #543810;
}

.leaderboard-search {
  margin-bottom: 12px;
}

.leaderboard-search-input {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 3px solid #8B6914;
  background: #F8F0D8;
  color: #543810;
  outline: none;
  box-sizing: border-box;
}

.leaderboard-search-input:focus {
  border-color: #F87820;
  box-shadow: 0 0 0 2px rgba(248, 120, 32, 0.3);
}

.leaderboard-search-input::placeholder {
  color: #8B6914;
}

.leaderboard-your-rank {
  background: rgba(248, 240, 216, 0.5);
  border: 2px solid #8B6914;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.leaderboard-your-rank-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: #8B6914;
  margin-bottom: 4px;
}

.leaderboard-your-rank-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.leaderboard-rank {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: #543810;
  min-width: 45px;
}

.leaderboard-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: #543810;
  flex: 1;
  text-align: left;
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leaderboard-score {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: #543810;
  min-width: 50px;
  text-align: right;
}

.leaderboard-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 12px;
  min-height: 150px;
  max-height: 250px;
}

.leaderboard-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(139, 105, 20, 0.3);
}

.leaderboard-entry:last-child {
  border-bottom: none;
}

.leaderboard-entry-highlight {
  background: rgba(84, 56, 16, 0.3);
}

.leaderboard-empty {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #8B6914;
  text-align: center;
  padding: 20px;
}

.leaderboard-loading {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #8B6914;
  text-align: center;
  padding: 20px;
}

.leaderboard-load-more {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  width: 100%;
  padding: 10px 16px;
  border: 3px solid #8B6914;
  background: #F8F0D8;
  color: #543810;
  cursor: pointer;
  transition: transform 0.1s;
}

.leaderboard-load-more:hover:not(:disabled) {
  background: #FFF8E8;
}

.leaderboard-load-more:active:not(:disabled) {
  transform: translateY(2px);
}

.leaderboard-load-more:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

**Step 2: Create the component file**

Create `src/components/LeaderboardModal.tsx`:

```typescript
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import './LeaderboardModal.css';

interface LeaderboardModalProps {
  onClose: () => void;
  isAuthenticated: boolean;
}

interface LeaderboardEntry {
  rank: number | null;
  displayName: string;
  bestScore: number;
}

interface UserRank {
  rank: number | null;
  bestScore: number;
}

export default function LeaderboardModal({ onClose, isAuthenticated }: LeaderboardModalProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentOffsetRef = useRef(0);

  const fetchLeaderboard = useCallback(async (offset: number, search?: string) => {
    try {
      let url = `/api/leaderboard?offset=${offset}&limit=20`;
      if (search && search.length >= 2) {
        url = `/api/leaderboard?search=${encodeURIComponent(search)}&limit=50`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
    return null;
  }, []);

  const fetchUserRank = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const res = await fetch('/api/leaderboard/me');
      if (res.ok) {
        const data = await res.json();
        if (data.nearbyPlayers) {
          const player = data.nearbyPlayers.find((p: { isPlayer: boolean }) => p.isPlayer);
          if (player) {
            setUserRank({ rank: player.rank, bestScore: player.bestScore });
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch user rank:', error);
    }
  }, [isAuthenticated]);

  // Initial load
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      const [leaderboardData] = await Promise.all([
        fetchLeaderboard(0),
        fetchUserRank(),
      ]);

      if (leaderboardData) {
        setEntries(leaderboardData.leaderboard);
        setTotal(leaderboardData.total);
        setHasMore(leaderboardData.leaderboard.length < leaderboardData.total);
        currentOffsetRef.current = leaderboardData.leaderboard.length;
      }
      setIsLoading(false);
    };

    loadInitial();
  }, [fetchLeaderboard, fetchUserRank]);

  // Handle search with throttling
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length === 0) {
      // Reset to initial state
      const resetToInitial = async () => {
        setIsLoading(true);
        const data = await fetchLeaderboard(0);
        if (data) {
          setEntries(data.leaderboard);
          setTotal(data.total);
          setHasMore(data.leaderboard.length < data.total);
          currentOffsetRef.current = data.leaderboard.length;
        }
        setIsLoading(false);
      };
      resetToInitial();
      return;
    }

    if (searchQuery.length < 2) return;

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      const data = await fetchLeaderboard(0, searchQuery);
      if (data) {
        setEntries(data.leaderboard);
        setTotal(data.total);
        setHasMore(false); // No pagination for search results
      }
      setIsLoading(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, fetchLeaderboard]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || searchQuery.length > 0) return;

    setIsLoadingMore(true);
    const data = await fetchLeaderboard(currentOffsetRef.current);
    if (data) {
      setEntries(prev => [...prev, ...data.leaderboard]);
      setHasMore(currentOffsetRef.current + data.leaderboard.length < data.total);
      currentOffsetRef.current += data.leaderboard.length;
    }
    setIsLoadingMore(false);
  };

  return (
    <div className="leaderboard-overlay">
      <div className="leaderboard-modal">
        <button className="leaderboard-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h1 className="leaderboard-title">LEADERBOARD</h1>

        <div className="leaderboard-search">
          <input
            type="text"
            className="leaderboard-search-input"
            placeholder="Search username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isAuthenticated && userRank && !searchQuery && (
          <div className="leaderboard-your-rank">
            <div className="leaderboard-your-rank-label">YOUR RANK</div>
            <div className="leaderboard-your-rank-row">
              <span className="leaderboard-rank">#{userRank.rank ?? '-'}</span>
              <span className="leaderboard-score">{userRank.bestScore}</span>
            </div>
          </div>
        )}

        <div className="leaderboard-list">
          {isLoading ? (
            <div className="leaderboard-loading">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="leaderboard-empty">
              {searchQuery ? 'No results found' : 'No scores yet'}
            </div>
          ) : (
            entries.map((entry, index) => (
              <div key={`${entry.rank}-${index}`} className="leaderboard-entry">
                <span className="leaderboard-rank">#{entry.rank ?? '-'}</span>
                <span className="leaderboard-name">{entry.displayName}</span>
                <span className="leaderboard-score">{entry.bestScore}</span>
              </div>
            ))
          )}
        </div>

        {!isLoading && hasMore && !searchQuery && (
          <button
            className="leaderboard-load-more"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/LeaderboardModal.tsx src/components/LeaderboardModal.css
git commit -m "feat: add LeaderboardModal component with search and pagination"
```

---

## Task 5: Wire up HomeScreen callbacks

**Files:**
- Modify: `src/components/HomeScreen.tsx`

**Step 1: Add onLeaderboardClick prop**

Update the props interface (around line 27):

```typescript
interface HomeScreenProps {
  onStart: () => void;
  isAuthenticated: boolean;
  userDisplayName: string | null;
  bestScore: number;
  onAccountClick: () => void;
  onLeaderboardClick: () => void;  // Add this
}
```

Update the destructuring (around line 35):

```typescript
export default function HomeScreen({ onStart, isAuthenticated, userDisplayName, bestScore, onAccountClick, onLeaderboardClick }: HomeScreenProps) {
```

**Step 2: Update button handlers**

Update the score button handler (around line 432-434):

```typescript
// Check if release is within score button bounds
if (isScorePressed && isInBounds(x, y, bounds.score)) {
  onLeaderboardClick();
}
```

Update the account button handler (around line 442-448):

```typescript
// Check if release is within account button bounds
if (isAccountPressed && isInBounds(x, y, bounds.account)) {
  onAccountClick();
}
```

**Step 3: Update render dependencies**

Update the useCallback dependency array (around line 460):

```typescript
}, [isPlayPressed, isScorePressed, isShopPressed, isAccountPressed, isSettingsPressed, getButtonBounds, onStart, onAccountClick, onLeaderboardClick]);
```

**Step 4: Commit**

```bash
git add src/components/HomeScreen.tsx
git commit -m "feat: wire up leaderboard and account button callbacks in HomeScreen"
```

---

## Task 6: Integrate modals into page.tsx

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add imports**

Add at the top of the file (after line 9):

```typescript
import LeaderboardModal from '@/components/LeaderboardModal';
import AccountModal from '@/components/AccountModal';
```

**Step 2: Add state for modals**

After line 37 (after showAuthModal state):

```typescript
const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
const [showAccountModal, setShowAccountModal] = useState(false);
```

**Step 3: Add callback handlers**

After handleAccountClick (around line 110):

```typescript
const handleLeaderboardClick = useCallback(() => {
  setShowLeaderboardModal(true);
}, []);

const handleAccountClickNew = useCallback(() => {
  if (isAuthenticated) {
    setShowAccountModal(true);
  } else {
    setShowAuthModal(true);
  }
}, [isAuthenticated]);
```

**Step 4: Update HomeScreen component**

Update the HomeScreen render (around line 219-226):

```typescript
<HomeScreen
  onStart={handleGoToGetReady}
  isAuthenticated={isAuthenticated}
  userDisplayName={session?.user?.displayName || null}
  bestScore={bestScore}
  onAccountClick={handleAccountClickNew}
  onLeaderboardClick={handleLeaderboardClick}
/>
```

**Step 5: Render the modals**

After the AuthModal render (around line 248), add:

```typescript
{showLeaderboardModal && (
  <LeaderboardModal
    onClose={() => setShowLeaderboardModal(false)}
    isAuthenticated={isAuthenticated}
  />
)}
{showAccountModal && (
  <AccountModal
    onClose={() => setShowAccountModal(false)}
  />
)}
```

**Step 6: Test manually**

Run: `npm run dev`
- Click leaderboard button → should show leaderboard modal
- Click account button (logged in) → should show account modal
- Click account button (logged out) → should show auth modal
- Test search in leaderboard
- Test load more in leaderboard
- Test sign out in account modal

**Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: integrate LeaderboardModal and AccountModal into page"
```

---

## Task 7: Build and final verification

**Step 1: Run TypeScript check**

```bash
npm run build
```

Expected: Build succeeds with no type errors

**Step 2: Test all flows**

1. Open https://localhost:3000
2. Click leaderboard → see scores, search, load more
3. Click account (not logged in) → see auth modal
4. Sign in
5. Click account → see stats and sign out button
6. Sign out → returns to home
7. Click leaderboard → see "Your Rank" section

**Step 3: Final commit and push**

```bash
git push
```
