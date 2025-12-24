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
  const [error, setError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentOffsetRef = useRef(0);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fetchLeaderboard = useCallback(async (offset: number, search?: string) => {
    try {
      let url = `/api/leaderboard?offset=${offset}&limit=20`;
      if (search && search.length >= 2) {
        url = `/api/leaderboard?search=${encodeURIComponent(search)}&limit=50`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load leaderboard');
      }
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      return null;
    }
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
      setError(null);
      const [leaderboardData] = await Promise.all([
        fetchLeaderboard(0),
        fetchUserRank(),
      ]);

      if (leaderboardData) {
        setEntries(leaderboardData.leaderboard);
        setTotal(leaderboardData.total);
        setHasMore(leaderboardData.leaderboard.length < leaderboardData.total);
        currentOffsetRef.current = leaderboardData.leaderboard.length;
      } else {
        setError('Failed to load leaderboard');
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

    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length === 0) {
      // Reset to initial state
      const resetToInitial = async () => {
        setIsLoading(true);
        setError(null);
        const data = await fetchLeaderboard(0);
        if (data) {
          setEntries(data.leaderboard);
          setTotal(data.total);
          setHasMore(data.leaderboard.length < data.total);
          currentOffsetRef.current = data.leaderboard.length;
        } else {
          setError('Failed to load leaderboard');
        }
        setIsLoading(false);
      };
      resetToInitial();
      return;
    }

    if (trimmedQuery.length < 2) return;

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      const data = await fetchLeaderboard(0, trimmedQuery);
      if (data) {
        setEntries(data.leaderboard);
        setTotal(data.total);
        setHasMore(false); // No pagination for search results
      } else {
        setError('Failed to search leaderboard');
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
            aria-label="Search leaderboard by username"
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
          ) : error ? (
            <div className="leaderboard-empty">{error}</div>
          ) : entries.length === 0 ? (
            <div className="leaderboard-empty">
              {searchQuery ? 'No results found' : 'No scores yet'}
            </div>
          ) : (
            entries.map((entry) => (
              <div key={`${entry.displayName}-${entry.rank}`} className="leaderboard-entry">
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
